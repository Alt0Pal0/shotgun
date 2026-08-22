import "server-only";
import { redirect } from "next/navigation";
import { backendConfigured, getBackend, type Backend, type SessionUser } from "@/lib/backend";
import type { Me, MyLive } from "@/lib/types";

export interface Ctx {
  backend: Backend;
  user: SessionUser;
  me: Me;
}

/** Server-side guard for pages. Redirects unauthenticated users, unverified users, and enforces the learner safety lock. */
export async function requireUser(
  opts: { allowUnverified?: boolean; enforceLock?: boolean; requireTrack?: boolean } = {},
): Promise<Ctx> {
  if (!backendConfigured()) redirect("/setup");
  const backend = await getBackend();
  const user = await backend.getUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified && !opts.allowUnverified) redirect("/verify");
  const me = await backend.rpc<Me>("me");
  if (opts.enforceLock !== false) {
    // The lock is a server fact: any learner page renders the locked route while a session is live.
    const live = await backend.rpc<MyLive>("my_live_session");
    const s = live.learner_session;
    if (s && (s.status === "ACTIVE" || s.status === "STOP_CANDIDATE")) redirect(`/drive/${s.id}/active`);
    if (s && (s.status === "REQUESTED" || s.status === "READY")) redirect(`/drive/${s.id}/waiting`);
  }
  if (opts.requireTrack && me.profile && !me.track && !me.profile.is_adult) redirect("/onboarding");
  return { backend, user, me };
}

export async function currentUser(): Promise<SessionUser | null> {
  const backend = await getBackend();
  return backend.getUser();
}
