"use client";
import Link from "next/link";
import { useActionState } from "react";
import { resendAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function ResendForm({ email, next }: { email?: string; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resendAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email ?? ""} />
      {state.sent && (
        <Alert tone="success">
          Verification email sent.
          {state.devVerifyUrl && (
            <>
              {" "}
              <Link
                className="underline"
                href={`${state.devVerifyUrl}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
              >
                Verify now
              </Link>
            </>
          )}
        </Alert>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" variant="secondary" block loading={pending}>
        Resend verification email
      </Button>
      <Button type="button" variant="ghost" block onClick={() => window.location.reload()}>
        I&apos;ve verified — refresh
      </Button>
    </form>
  );
}
