"use client";
import { api } from "@/lib/client/api";
import { markAcked, unackedSamples } from "./buffer";

export interface SyncResult { uploaded: number; duplicates: number; status?: string; can_end?: boolean; stationary_seconds?: number; offline: boolean }

/**
 * Upload unacknowledged samples in bounded idempotent batches. Safe to call repeatedly; a batch is only marked
 * acknowledged after the server responds. Network failures leave samples in IndexedDB.
 */
export async function syncSamples(sessionId: string, deviceId: string, batchSize = 100): Promise<SyncResult> {
  let uploaded = 0, duplicates = 0, status: string | undefined, can_end: boolean | undefined, stationary_seconds: number | undefined;
  for (;;) {
    const batch = await unackedSamples(sessionId, batchSize);
    if (!batch.length) break;
    try {
      const r = await api.post<{ accepted: number; duplicates: number; status: string; can_end: boolean; stationary_seconds: number; ignored?: boolean }>(`/api/drives/${sessionId}/samples`, { device_id: deviceId, samples: batch });
      await markAcked(sessionId, batch.map((s) => s.sequence_no));
      uploaded += r.accepted; duplicates += r.duplicates; status = r.status; can_end = r.can_end; stationary_seconds = r.stationary_seconds;
      if (r.ignored) break;
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 4xx means the server rejected the batch for a durable reason (e.g., session no longer live): do not retry forever.
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) { await markAcked(sessionId, batch.map((s) => s.sequence_no)); continue; }
      return { uploaded, duplicates, status: undefined, offline: true };
    }
  }
  return { uploaded, duplicates, status, can_end, stationary_seconds, offline: false };
}
