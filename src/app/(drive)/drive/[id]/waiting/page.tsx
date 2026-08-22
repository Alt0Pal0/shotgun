import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { LockState } from "@/lib/types";
import { WaitingClient } from "./WaitingClient";

export default async function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend } = await requireUser({ enforceLock: false });
  const lock = await backend.rpc<LockState | null>("lock_state", { p_session: id });
  if (!lock) notFound();
  if (lock.status === "ACTIVE" || lock.status === "STOP_CANDIDATE") redirect(`/drive/${id}/active`);
  if (!["REQUESTED", "READY"].includes(lock.status)) redirect(`/drives/${id}`);
  return <WaitingClient initial={lock} />;
}
