import Link from "next/link";
import { redirect } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { AuthShell } from "../AuthShell";
import { ResendForm } from "./ResendForm";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; next?: string; invalid?: string; emailError?: string }>;
}) {
  const sp = await searchParams;
  const backend = await getBackend();
  const user = await backend.getUser();
  if (user?.emailVerified) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/");
  return (
    <AuthShell
      title="Check your email"
      subtitle={
        user?.email
          ? `We sent a verification link to ${user.email}. Open it on this phone to continue.`
          : "If this address is new, we sent a verification link. If it already has an account, we sent sign-in help instead. Open the email on this phone to continue."
      }
    >
      {sp.emailError && (
        <p className="mb-4 rounded-xl border border-rose/50 bg-rose/10 p-3 text-sm">
          Your account was created, but the verification email could not be sent ({sp.emailError}). You can resend
          below.
        </p>
      )}
      {sp.invalid && (
        <p className="mb-4 rounded-xl border border-rose/50 bg-rose/10 p-3 text-sm">
          That verification link is invalid or expired. Request a new one below.
        </p>
      )}
      {sp.dev && (
        <p className="mb-4 rounded-xl border border-amber/50 bg-amber/10 p-3 text-sm">
          No email provider is configured for this environment, so the link is shown here instead.{" "}
          <Link
            className="font-semibold underline"
            href={`${sp.dev}${sp.next ? `&next=${encodeURIComponent(sp.next)}` : ""}`}
          >
            Verify this account now
          </Link>
          .
        </p>
      )}
      <ResendForm email={user?.email} next={sp.next} />
      <p className="mt-6 text-center text-sm text-muted">
        <Link className="underline" href="/sign-in">
          Use a different account
        </Link>
      </p>
    </AuthShell>
  );
}
