import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { backendConfigured, getBackend } from "@/lib/backend";
import { redirect } from "next/navigation";
import { AcceptInvite } from "./AcceptInvite";
import { Shell, PageHeader } from "@/components/ui/Page";
import { Alert } from "@/components/ui/Alert";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  let first = "A learner driver";
  try {
    if (backendConfigured()) {
      const p = await (
        await getBackend()
      ).rpc<{ valid: boolean; learner_display_name?: string }>("preview_invitation", { p_token: token });
      if (p?.valid && p.learner_display_name) first = p.learner_display_name.split(" ")[0];
    }
  } catch {
    /* generic */
  }
  const title = `${first} wants you to ride shotgun 🤘`;
  const description = `Come ride shotgun with me on ${BRAND}. Link your account to supervise, review, and approve practice drives.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!backendConfigured()) redirect("/setup");
  const backend = await getBackend();
  const preview = await backend.rpc<{
    valid: boolean;
    reason?: string;
    learner_display_name?: string;
    expires_at?: string;
  }>("preview_invitation", { p_token: token });
  const user = await backend.getUser();
  const next = `/invite/${token}`;
  return (
    <Shell>
      <PageHeader
        eyebrow="Invitation"
        title={preview.valid ? `Ride shotgun with ${preview.learner_display_name}?` : "Invitation unavailable"}
      />
      {!preview.valid ? (
        <Alert tone="warn">
          This link{" "}
          {preview.reason === "EXPIRED"
            ? "has expired"
            : preview.reason === "USED"
              ? "was already used"
              : preview.reason === "REVOKED"
                ? "was revoked"
                : "is not valid"}
          . Ask the learner for a new one.
        </Alert>
      ) : !user ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Sign in or create a parent/supervisor account to accept.</p>
          <Link
            href={`/sign-up?role=adult&next=${encodeURIComponent(next)}`}
            className="tap block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-accent-ink"
          >
            Create account
          </Link>
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="tap block rounded-xl border border-border px-4 py-3 text-center font-semibold"
          >
            Sign in
          </Link>
        </div>
      ) : !user.emailVerified ? (
        <Alert tone="warn">
          Verify your email first, then return to this link.{" "}
          <Link className="underline" href={`/verify?next=${encodeURIComponent(next)}`}>
            Verify
          </Link>
        </Alert>
      ) : (
        <AcceptInvite token={token} learnerName={preview.learner_display_name ?? "the learner"} />
      )}
    </Shell>
  );
}
