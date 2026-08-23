import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { backendConfigured, getBackend, type Backend, type SessionUser } from "@/lib/backend";
import type { Me, MyLive } from "@/lib/types";
import { TERMS_VERSION } from "@/lib/legal/documents";

export interface Ctx {
  backend: Backend;
  user: SessionUser;
  me: Me;
  live: MyLive;
}

/** One round-trip per request for user + profile + live-session context (deduped across layout and page). */
const loadContext = cache(async () => {
  const backend = await getBackend();
  const user = await backend.getUser();
  if (!user) return { backend, user: null, me: null, live: null };
  const bundle = await backend.rpc<{ me: Me; live: MyLive }>("session_context");
  return { backend, user, me: bundle.me, live: bundle.live };
});

/** Server-side guard for pages. Redirects unauthenticated users, unverified users, and enforces the learner safety lock. */
export async function requireUser(
  opts: { allowUnverified?: boolean; enforceLock?: boolean; requireTrack?: boolean } = {},
): Promise<Ctx> {
  if (!backendConfigured()) redirect("/setup");
  const { backend, user, me, live } = await loadContext();
  if (!user || !me || !live) redirect("/sign-in");
  if (!user.emailVerified && !opts.allowUnverified) redirect("/verify");
  // Everyone must have accepted the current terms (recorded with IP/UA) before using the product.
  if (me.profile && me.profile.terms_version !== TERMS_VERSION) redirect("/accept-terms");
  if (opts.enforceLock !== false) {
    // The lock is a server fact: any learner page renders the locked route while a session is live.
    const s = live.learner_session;
    if (s && (s.status === "ACTIVE" || s.status === "STOP_CANDIDATE")) redirect(`/drive/${s.id}/active`);
    if (s && (s.status === "REQUESTED" || s.status === "READY")) redirect(`/drive/${s.id}/waiting`);
  }
  if (opts.requireTrack && me.profile && !me.track && !me.profile.is_adult) redirect("/onboarding");
  return { backend, user, me, live };
}

export async function currentUser(): Promise<SessionUser | null> {
  const backend = await getBackend();
  return backend.getUser();
}
