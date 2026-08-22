"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { browserSupabase } from "@/lib/client/supabase";
import type { LiveView } from "@/lib/types";

export interface LiveConnection { mode: "realtime" | "polling"; connected: boolean; lastUpdateAt: number | null }

/**
 * Authorized live-session subscription for adults. Initial load via /api (RLS-filtered), then Supabase Realtime
 * postgres_changes on live_session_state / drive_observations / drive_sessions (filtered by session, authorized by RLS).
 * Always keeps a slow poll as a fallback so a realtime outage degrades to "stale" rather than "broken".
 */
export function useLiveSession(sessionId: string) {
  const [view, setView] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<LiveConnection>({ mode: "polling", connected: false, lastUpdateAt: null });
  const [clock, setClock] = useState<{ now: number; skew: number }>({ now: 0, skew: 0 });
  const [trail, setTrail] = useState<[number, number][]>([]);

  const refresh = useCallback(async () => {
    try {
      const v = await api.get<LiveView>(`/api/drives/${sessionId}/live`);
      const skew = Date.parse(v.server_time) - Date.now();
      setClock({ now: Date.now(), skew });
      setView(v); setError(null); setConn((c) => ({ ...c, connected: true, lastUpdateAt: Date.now() }));
      if (v.live.latest_latitude != null && v.live.latest_longitude != null) {
        const pt: [number, number] = [v.live.latest_longitude, v.live.latest_latitude];
        setTrail((t) => { const last = t.at(-1); return last && last[0] === pt[0] && last[1] === pt[1] ? t : [...t.slice(-400), pt]; });
      }
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403 || err.status === 404) setError(err.message ?? "No access");
      else setConn((c) => ({ ...c, connected: false }));
    }
  }, [sessionId]);

  useEffect(() => {
    const sb = browserSupabase();
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), sb ? 20_000 : 4_000);
    const tick = setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 1000);
    let channel: ReturnType<NonNullable<typeof sb>["channel"]> | null = null;
    if (sb) {
      channel = sb.channel(`live:${sessionId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "live_session_state", filter: `session_id=eq.${sessionId}` }, () => void refresh())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "drive_observations", filter: `session_id=eq.${sessionId}` }, () => void refresh())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drive_sessions", filter: `id=eq.${sessionId}` }, () => void refresh())
        .subscribe((status: string) => setConn((c) => ({ ...c, mode: status === "SUBSCRIBED" ? "realtime" : "polling", connected: status === "SUBSCRIBED" ? true : c.connected })));
    }
    return () => { clearTimeout(first); clearInterval(poll); clearInterval(tick); if (sb && channel) void sb.removeChannel(channel); };
  }, [sessionId, refresh]);

  const serverNow = (clock.now || Date.parse(view?.server_time ?? "") || 0) + clock.skew;
  return { view, error, conn, refresh, serverNow, trail };
}
