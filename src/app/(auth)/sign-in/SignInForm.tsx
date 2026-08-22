"use client";
import { useActionState, useState } from "react";
import { signInAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" block loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
