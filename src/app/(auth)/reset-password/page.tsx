"use client";
import { useActionState } from "react";
import { resetAction, type AuthState } from "../actions";
import { AuthShell } from "../AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export default function ResetPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetAction, {});
  return (
    <AuthShell title="Choose a new password">
      <form action={action} className="space-y-4">
        <Input label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" size="lg" block loading={pending}>Update password</Button>
      </form>
    </AuthShell>
  );
}
