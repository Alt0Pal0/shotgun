import { redirect } from "next/navigation";
import { getBackend } from "@/lib/backend";
import type { Me } from "@/lib/types";

export default async function Index() {
  const backend = await getBackend();
  const user = await backend.getUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified) redirect("/verify");
  const me = await backend.rpc<Me>("me");
  if (me.track) redirect("/home");
  if (me.profile?.is_adult || me.learners.length) redirect("/reviews");
  redirect("/onboarding");
}
