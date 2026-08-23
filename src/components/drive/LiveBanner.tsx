"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { MyLive } from "@/lib/types";

/** Adult shell banner: surfaces drive requests and live sessions. Polls every 10 s (cheap RPC, no location). */
export function LiveBanner() {
  const [live, setLive] = useState<MyLive | null>(null);
  useEffect(() => {
    let on = true;
    const load = () =>
      api
        .get<MyLive>("/api/live")
        .then((d) => on && setLive(d))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 10_000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);
  if (!live?.adult_sessions.length) return null;
  return (
    <div className="mb-4 space-y-2" aria-live="polite">
      {live.adult_sessions.map((s) => {
        const requested = s.status === "REQUESTED";
        const href = requested || s.status === "READY" ? `/drive/${s.id}/accept` : `/drive/${s.id}/live`;
        return (
          <Link
            key={s.id}
            href={href}
            className={`card block border-2 p-3 ${requested ? "border-amber" : "border-accent"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {requested
                ? "Drive request"
                : s.status === "READY"
                  ? "Ready — waiting for recorder"
                  : "Drive in progress"}
            </p>
            <p className="font-semibold">
              {s.learner.display_name} {requested ? "called shotgun — will you ride along?" : "is driving now"}
            </p>
            <p className="text-sm text-accent">
              {requested
                ? s.is_designated
                  ? "Confirm from the passenger seat →"
                  : "Waiting for the designated adult"
                : "Open the shotgun view →"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
