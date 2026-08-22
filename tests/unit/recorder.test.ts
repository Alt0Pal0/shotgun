import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  appendSample,
  clearPendingEnd,
  markAcked,
  nextSequence,
  pendingEnd,
  queueEnd,
  unackedCount,
  unackedSamples,
} from "@/lib/recorder/buffer";
import { syncSamples } from "@/lib/recorder/sync";
import type { LocationSample } from "@/lib/gps";

const s = (n: number): LocationSample => ({
  sequence_no: n,
  recorded_at: new Date(1_700_000_000_000 + n * 5000).toISOString(),
  latitude: 37.7 + n * 0.0001,
  longitude: -122.4,
  accuracy_m: 8,
  speed_mps: 10,
  heading_deg: 0,
});

describe("IndexedDB sample buffer (US-007 / FR-022 / §12.1)", () => {
  const sid = () => `sess-${Math.random().toString(36).slice(2)}`;
  it("buffers samples, tracks sequence numbers across reloads, and only drops acknowledged ones", async () => {
    const id = sid();
    for (let i = 0; i < 5; i++) await appendSample(id, s(i));
    expect(await unackedCount(id)).toBe(5);
    expect(await nextSequence(id)).toBe(5);
    await markAcked(id, [0, 1, 2]);
    expect((await unackedSamples(id)).map((x) => x.sequence_no)).toEqual([3, 4]);
    expect(await nextSequence(id)).toBe(5); // acknowledged samples still reserve their sequence numbers
  });
  it("queues and clears a pending end action", async () => {
    const id = sid();
    await queueEnd(id, { override_reason: "gps lost" });
    expect((await pendingEnd(id))?.payload).toEqual({ override_reason: "gps lost" });
    await clearPendingEnd(id);
    expect(await pendingEnd(id)).toBeUndefined();
  });
});

describe("idempotent batch sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it("keeps samples when offline and uploads them all after reconnecting, without duplicates", async () => {
    const id = `sess-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 120; i++) await appendSample(id, s(i));
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const offline = await syncSamples(id, "dev", 100);
    expect(offline).toMatchObject({ uploaded: 0, offline: true });
    expect(await unackedCount(id)).toBe(120);

    const seen: number[] = [];
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { samples: LocationSample[] };
      seen.push(...body.samples.map((x) => x.sequence_no));
      return new Response(
        JSON.stringify({
          accepted: body.samples.length,
          duplicates: 0,
          status: "ACTIVE",
          can_end: false,
          stationary_seconds: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const online = await syncSamples(id, "dev", 100);
    expect(online).toMatchObject({ uploaded: 120, offline: false, status: "ACTIVE" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 failed + 2 batches (100 + 20)
    expect(new Set(seen).size).toBe(120);
    expect(await unackedCount(id)).toBe(0);
    expect((await syncSamples(id, "dev")).uploaded).toBe(0);
  });
  it("does not retry forever when the server rejects a batch for a durable reason", async () => {
    const id = `sess-${Math.random().toString(36).slice(2)}`;
    await appendSample(id, s(0));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "no" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await syncSamples(id, "dev");
    expect(r.offline).toBe(false);
    expect(await unackedCount(id)).toBe(0);
  });
});
