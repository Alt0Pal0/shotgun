"use server";
import { redirect } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

export interface AuthState {
  error?: string;
  devVerifyUrl?: string;
  sent?: boolean;
}

export async function signUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    displayName: form.get("displayName"),
    role: form.get("role"),
    ageConfirmed: form.get("ageConfirmed") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const backend = await getBackend();
  const r = await backend.signUp(parsed.data);
  if (!r.ok) return { error: r.error };
  await backend
    .rpc("track_event", { p_event: "account_created", p_props: { role: parsed.data.role } })
    .catch(() => undefined);
  const next = form.get("next");
  redirect(
    `/verify${r.devVerifyUrl ? `?dev=${encodeURIComponent(r.devVerifyUrl)}` : ""}${typeof next === "string" && next ? `${r.devVerifyUrl ? "&" : "?"}next=${encodeURIComponent(next)}` : ""}`,
  );
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password" };
  const backend = await getBackend();
  const r = await backend.signIn(parsed.data);
  if (!r.ok) return { error: r.error };
  const next = form.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
}

export async function signOutAction() {
  const backend = await getBackend();
  await backend.signOut();
  redirect("/sign-in");
}

export async function resendAction(_: AuthState, form: FormData): Promise<AuthState> {
  const backend = await getBackend();
  const user = await backend.getUser();
  const email = user?.email ?? String(form.get("email") ?? "");
  const r = await backend.resendVerification(email);
  return r.ok ? { sent: true, devVerifyUrl: r.devVerifyUrl } : { error: r.error };
}

export async function forgotAction(_: AuthState, form: FormData): Promise<AuthState> {
  const backend = await getBackend();
  const r = await backend.requestPasswordReset(String(form.get("email") ?? ""));
  return r.ok ? { sent: true } : { error: r.error };
}

export async function resetAction(_: AuthState, form: FormData): Promise<AuthState> {
  const pw = String(form.get("password") ?? "");
  if (pw.length < 8) return { error: "Password must be at least 8 characters" };
  const backend = await getBackend();
  const r = await backend.updatePassword(pw);
  if (!r.ok) return { error: r.error };
  redirect("/");
}

export async function resetWithTokenAction(_: AuthState, form: FormData): Promise<AuthState> {
  const pw = String(form.get("password") ?? "");
  const token = String(form.get("token") ?? "");
  if (pw.length < 8) return { error: "Password must be at least 8 characters" };
  const { backendMode } = await import("@/lib/backend");
  if (backendMode() !== "postgres") return { error: "Not available" };
  const { consumeResetToken } = await import("@/lib/backend/postgres");
  const ok = await consumeResetToken(token, pw).catch(() => false);
  if (!ok) return { error: "This reset link is invalid or has expired. Request a new one." };
  redirect("/");
}
