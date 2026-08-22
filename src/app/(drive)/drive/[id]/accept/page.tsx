import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { SessionDetail } from "@/lib/types";
import { AcceptClient } from "./AcceptClient";

export default async function AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, user } = await requireUser({ enforceLock: true });
  const s = await backend.rpc<SessionDetail | null>("session_detail", { p_session: id });
  if (!s) notFound();
  if (s.status === "ACTIVE" || s.status === "STOP_CANDIDATE") redirect(`/drive/${id}/live`);
  if (s.status !== "REQUESTED" && s.status !== "READY") redirect(`/drives/${id}`);
  return <AcceptClient session={s} isDesignated={s.supervisor_id === user.id} />;
}
