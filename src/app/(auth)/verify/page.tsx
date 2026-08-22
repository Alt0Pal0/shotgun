import Link from "next/link";
import { redirect } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { AuthShell } from "../AuthShell";
import { ResendForm } from "./ResendForm";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ dev?: string; next?: string }> }) {
  const sp = await searchParams;
  const backend = await getBackend();
  const user = await backend.getUser();
  if (user?.emailVerified) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/");
  return (
    <AuthShell
      title="Check your email"
      subtitle={`We sent a verification link${user?.email ? ` to ${user.email}` : ""}. Open it on this phone to continue.`}
    >
      {backend.mode === "local" && sp.dev && (
        <p className="mb-4 rounded-xl border border-amber/50 bg-amber/10 p-3 text-sm">
          Local development: no email is sent.{" "}
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
