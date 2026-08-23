import { redirect } from "next/navigation";
import { getBackend, backendConfigured } from "@/lib/backend";
import { TERMS_VERSION } from "@/lib/legal/documents";
import type { Me } from "@/lib/types";
import { AcceptTermsForm } from "./AcceptTermsForm";

export default async function AcceptTermsPage() {
  if (!backendConfigured()) redirect("/setup");
  const backend = await getBackend();
  const user = await backend.getUser();
  if (!user) redirect("/sign-in");
  const me = await backend.rpc<Me>("me");
  if (me.profile?.terms_version === TERMS_VERSION) redirect("/");
  return (
    <main id="main" className="mx-auto w-full max-w-md px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Shotgun.Rocks 🤘</p>
      <h1 className="mt-2 text-2xl font-bold">
        {me.profile?.terms_version ? "Our terms have changed" : "One more thing before you ride"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Please review and accept to continue. Your acceptance is recorded with the date, time, IP address, and device.
      </p>
      <AcceptTermsForm />
    </main>
  );
}
