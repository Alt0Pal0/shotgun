import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { SignUpForm } from "./SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Private beta for California learner drivers and the adults who ride shotgun."
    >
      <SignUpForm
        defaultRole={sp.role === "adult" ? "adult" : sp.role === "learner" ? "learner" : null}
        next={sp.next}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          className="text-accent underline"
          href={`/sign-in${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`}
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
