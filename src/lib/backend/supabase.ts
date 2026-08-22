import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { LocationSample } from "@/lib/gps";
import { toAppError } from "./errors";
import { AppError, type AuthResult, type Backend, type SessionUser } from "./types";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new AppError("CONFIG", `Missing environment variable ${name}`, 500);
  return v;
}

async function userClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try { for (const { name, value, options } of toSet) cookieStore.set(name, value, options); } catch { /* server component: handled by proxy refresh */ }
      },
    },
  });
}

function serviceClient(): SupabaseClient {
  // Service role key is only ever read on the server; it is never bundled to the browser.
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

function appUrl(): string { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"; }

export const supabaseBackend: Backend = {
  mode: "supabase",
  async getUser(): Promise<SessionUser | null> {
    const sb = await userClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "", emailVerified: Boolean(data.user.email_confirmed_at) };
  },
  async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const sb = await userClient();
    const { data, error } = await sb.schema("app").rpc(fn, args);
    if (error) throw toAppError(error);
    return data as T;
  },
  async serviceRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await serviceClient().schema("app").rpc(fn, args);
    if (error) throw toAppError(error);
    return data as T;
  },
  async serviceSamples(sessionId: string): Promise<LocationSample[]> {
    const { data, error } = await serviceClient().from("location_samples")
      .select("sequence_no, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg").eq("session_id", sessionId).order("sequence_no");
    if (error) throw toAppError(error);
    return (data ?? []) as LocationSample[];
  },
  async signUp({ email, password, displayName, role }): Promise<AuthResult> {
    const sb = await userClient();
    const { error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName, role }, emailRedirectTo: `${appUrl()}/auth/callback` } });
    if (error) return { ok: false, error: error.message };
    return { ok: true, needsVerification: true };
  },
  async signIn({ email, password }): Promise<AuthResult> {
    const sb = await userClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },
  async signOut() { const sb = await userClient(); await sb.auth.signOut(); },
  async resendVerification(email): Promise<AuthResult> {
    const sb = await userClient();
    const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${appUrl()}/auth/callback` } });
    return error ? { ok: false, error: error.message } : { ok: true, needsVerification: true };
  },
  async requestPasswordReset(email): Promise<AuthResult> {
    const sb = await userClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/callback?next=/reset-password` });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  async updatePassword(newPassword): Promise<AuthResult> {
    const sb = await userClient();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
};
