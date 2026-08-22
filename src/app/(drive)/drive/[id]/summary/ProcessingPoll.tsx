"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/client/api";
export function ProcessingPoll({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(async () => { try { const r = await api.post<{ status: string }>(`/api/drives/${sessionId}/process`); if (r.status !== "ENDED") router.refresh(); } catch { /* retry */ } }, 4000);
    return () => clearInterval(t);
  }, [sessionId, router]);
  return null;
}
