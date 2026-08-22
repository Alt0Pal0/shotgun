"use client";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LocationSample } from "@/lib/gps";

/**
 * Typed IndexedDB buffer for GPS samples and pending end actions (PRD FR-022, §12.1).
 * Samples remain until the server acknowledges them; acknowledged batches are cleaned up after 24 h.
 */
interface RecorderDB extends DBSchema {
  samples: {
    key: [string, number];
    value: LocationSample & { session_id: string; acked_at?: number };
    indexes: { by_session: string };
  };
  pending_actions: {
    key: string;
    value: { id: string; session_id: string; type: "end"; payload: Record<string, unknown>; created_at: number };
  };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<RecorderDB>> | null = null;
export function db(): Promise<IDBPDatabase<RecorderDB>> {
  dbPromise ??= openDB<RecorderDB>("ldp-recorder", 1, {
    upgrade(d) {
      const s = d.createObjectStore("samples", { keyPath: ["session_id", "sequence_no"] });
      s.createIndex("by_session", "session_id");
      d.createObjectStore("pending_actions", { keyPath: "id" });
      d.createObjectStore("meta", { keyPath: "key" });
    },
  });
  return dbPromise;
}

export async function appendSample(sessionId: string, sample: LocationSample): Promise<void> {
  const d = await db();
  await d.put("samples", { ...sample, session_id: sessionId });
}

export async function unackedSamples(sessionId: string, limit = 200): Promise<LocationSample[]> {
  const d = await db();
  const all = await d.getAllFromIndex("samples", "by_session", sessionId);
  return all
    .filter((s) => s.acked_at == null)
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .slice(0, limit)
    .map((s) => ({
      sequence_no: s.sequence_no,
      recorded_at: s.recorded_at,
      latitude: s.latitude,
      longitude: s.longitude,
      accuracy_m: s.accuracy_m,
      speed_mps: s.speed_mps,
      heading_deg: s.heading_deg,
    }));
}

export async function markAcked(sessionId: string, sequenceNos: number[]): Promise<void> {
  const d = await db();
  const tx = d.transaction("samples", "readwrite");
  for (const n of sequenceNos) {
    const row = await tx.store.get([sessionId, n]);
    if (row) await tx.store.put({ ...row, acked_at: Date.now() });
  }
  await tx.done;
}

export async function unackedCount(sessionId: string): Promise<number> {
  return (await unackedSamples(sessionId, 100_000)).length;
}

export async function nextSequence(sessionId: string): Promise<number> {
  const d = await db();
  const all = await d.getAllFromIndex("samples", "by_session", sessionId);
  return all.reduce((m, s) => Math.max(m, s.sequence_no + 1), 0);
}

export async function cleanupAcked(olderThanMs = 24 * 3600_000): Promise<void> {
  const d = await db();
  const tx = d.transaction("samples", "readwrite");
  let cur = await tx.store.openCursor();
  const cutoff = Date.now() - olderThanMs;
  while (cur) {
    if (cur.value.acked_at != null && cur.value.acked_at < cutoff) await cur.delete();
    cur = await cur.continue();
  }
  await tx.done;
}

export async function queueEnd(sessionId: string, payload: Record<string, unknown>): Promise<void> {
  const d = await db();
  await d.put("pending_actions", {
    id: `end:${sessionId}`,
    session_id: sessionId,
    type: "end",
    payload,
    created_at: Date.now(),
  });
}
export async function pendingEnd(sessionId: string) {
  return (await db()).get("pending_actions", `end:${sessionId}`);
}
export async function clearPendingEnd(sessionId: string) {
  await (await db()).delete("pending_actions", `end:${sessionId}`);
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put("meta", { key, value });
}
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key))?.value as T | undefined;
}
