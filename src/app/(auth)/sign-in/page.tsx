import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Sign in">
      <SignInForm next={sp.next} />
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link
          className="text-accent underline"
          href={`/sign-up${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`}
        >
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        <Link className="underline" href="/forgot-password">
          Forgot password?
        </Link>
      </p>
    </AuthShell>
  );
}
