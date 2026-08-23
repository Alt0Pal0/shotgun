export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public hint?: string,
  ) {
    super(message);
  }
}

export type AuthResult =
  { ok: true; needsVerification?: boolean; devVerifyUrl?: string; emailError?: string } | { ok: false; error: string };

/**
 * Backend boundary. Every data operation is an `app.*` RPC executed under the caller's RLS context.
 * Implementations: Supabase (production) and LocalPg (development/tests without Supabase credentials).
 */
export interface Backend {
  readonly mode: "supabase" | "postgres";
  getUser(): Promise<SessionUser | null>;
  /** Execute `app.<fn>` as the signed-in user. */
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  /** Execute `app.<fn>` with service-role privileges. Server only. */
  serviceRpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  /** Read raw location samples for a session (server-side route processing). Service role. */
  serviceSamples(sessionId: string): Promise<import("@/lib/gps").LocationSample[]>;
  signUp(input: {
    email: string;
    password: string;
    displayName: string;
    role: "learner" | "adult";
  }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;
}
