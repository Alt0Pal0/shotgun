"use client";
import { useActionState } from "react";
import { resetWithTokenAction, type AuthState } from "@/app/(auth)/actions";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function ResetWithTokenForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetWithTokenAction, {});
  return (
    <AuthShell title="Choose a new password">
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Input
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Button type="submit" size="lg" block loading={pending}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
