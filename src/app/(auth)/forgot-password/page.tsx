"use client";
import { useActionState } from "react";
import { forgotAction, type AuthState } from "../actions";
import { AuthShell } from "../AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export default function ForgotPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotAction, {});
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send a reset link.">
      <form action={action} className="space-y-4">
        <Input label="Email" name="email" type="email" required autoComplete="email" />
        {state.sent && <Alert tone="success">If an account exists for that email, a reset link is on its way.</Alert>}
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" size="lg" block loading={pending}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
