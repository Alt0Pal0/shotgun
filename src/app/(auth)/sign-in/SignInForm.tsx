"use client";
import { useActionState } from "react";
import { signInAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, {});
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" block loading={pending}>Sign in</Button>
    </form>
  );
}
