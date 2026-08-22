"use client";
export class ApiError extends Error { constructor(public code: string, message: string, public status: number, public hint?: string, public issues?: unknown) { super(message); } }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = data?.error ?? {}; throw new ApiError(e.code ?? "ERROR", e.message ?? res.statusText, res.status, e.hint, e.issues); }
  return data as T;
}
export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => call<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => call<T>("DELETE", path, body),
};

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
