"use client";
import { useActionState, useState } from "react";
import { signUpAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { PRIVACY_COPY } from "@/lib/copy";
import { LegalCheckboxes } from "@/components/legal/LegalCheckboxes";

export function SignUpForm({ defaultRole, next }: { defaultRole: "learner" | "adult" | null; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, {});
  const [role, setRole] = useState<"learner" | "adult" | null>(defaultRole);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", ageConfirmed: false });
  const [legal, setLegal] = useState({ terms: false, risk: false });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          I am a… <span className="text-rose">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(["learner", "adult"] as const).map((r) => (
            <label
              key={r}
              className={`tap flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-semibold ${role === r ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-2"}`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "learner" ? "Learner driver" : "Parent / supervisor"}
            </label>
          ))}
        </div>
      </fieldset>
      <Input
        label="Your name"
        name="displayName"
        autoComplete="name"
        required
        maxLength={60}
        value={form.displayName}
        onChange={set("displayName")}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={set("email")}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters"
        value={form.password}
        onChange={set("password")}
      />
      <Checkbox
        name="ageConfirmed"
        required
        label="I am 13 or older"
        checked={form.ageConfirmed}
        onChange={set("ageConfirmed")}
        hint={
          role === "learner"
            ? "Learners under 18 must link a parent or supervising adult before an approved drive can count."
            : undefined
        }
      />
      <LegalCheckboxes
        terms={legal.terms}
        risk={legal.risk}
        onTerms={(v) => setLegal({ ...legal, terms: v })}
        onRisk={(v) => setLegal({ ...legal, risk: v })}
        names={{ terms: "acceptTerms", risk: "acceptRisk" }}
      />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {!role && <p className="text-xs text-muted">Choose Learner driver or Parent / supervisor to continue.</p>}
      <Button type="submit" size="lg" block loading={pending} disabled={!role || !legal.terms || !legal.risk}>
        Create account
      </Button>
      <p className="text-xs text-muted">{PRIVACY_COPY}</p>
      <p className="text-xs text-muted">
        Your acceptance is recorded with the date, time, IP address, and device for our records.
      </p>
    </form>
  );
}
