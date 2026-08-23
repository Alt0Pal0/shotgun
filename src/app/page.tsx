import { redirect } from "next/navigation";
import { backendConfigured, getBackend } from "@/lib/backend";
import type { Me } from "@/lib/types";
import { TERMS_VERSION } from "@/lib/legal/documents";

export default async function Index() {
  if (!backendConfigured()) redirect("/setup");
  const backend = await getBackend();
  const user = await backend.getUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified) redirect("/verify");
  const me = await backend.rpc<Me>("me");
  if (me.profile && me.profile.terms_version !== TERMS_VERSION) redirect("/accept-terms");
  if (me.track) redirect("/home");
  if (me.profile?.is_adult || me.learners.length) redirect("/reviews");
  redirect("/onboarding");
}
