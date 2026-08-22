import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { LockState } from "@/lib/types";
import { LockedDrive } from "./LockedDrive";

/**
 * Learner safety-locked screen. Server-rendered from lock_state only (status + start time). The learner is denied by RLS
 * on live state, routes, samples and observations, so nothing else can be fetched from this page.
 */
export default async function ActiveDrivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend } = await requireUser({ enforceLock: false });
  const lock = await backend.rpc<LockState | null>("lock_state", { p_session: id });
  if (!lock) notFound();
  if (lock.status === "REQUESTED" || lock.status === "READY") redirect(`/drive/${id}/waiting`);
  if (lock.status !== "ACTIVE" && lock.status !== "STOP_CANDIDATE") redirect(`/drive/${id}/summary`);
  return <LockedDrive initial={lock} />;
}
