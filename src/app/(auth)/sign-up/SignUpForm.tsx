"use client";
import { useActionState, useState } from "react";
import { signUpAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { BETA_TERMS_PLACEHOLDER, PRIVACY_COPY } from "@/lib/copy";

export function SignUpForm({ defaultRole, next }: { defaultRole: "learner" | "adult"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, {});
  const [role, setRole] = useState(defaultRole);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I am a…</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["learner", "adult"] as const).map((r) => (
            <label key={r} className={`tap flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-semibold ${role === r ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-2"}`}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              {r === "learner" ? "Learner driver" : "Parent / supervisor"}
            </label>
          ))}
        </div>
      </fieldset>
      <Input label="Your name" name="displayName" autoComplete="name" required maxLength={60} />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters" />
      <Checkbox name="ageConfirmed" required label="I am 13 or older" hint={role === "learner" ? "Learners under 18 must link a parent or supervising adult before an approved drive can count." : undefined} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" block loading={pending}>Create account</Button>
      <p className="text-xs text-muted">{PRIVACY_COPY}</p>
      <p className="text-xs text-muted">{BETA_TERMS_PLACEHOLDER}</p>
    </form>
  );
}
