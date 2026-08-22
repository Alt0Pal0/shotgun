import { randomUUID } from "node:crypto";
import { json, withAuth } from "@/lib/api";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.idempotency_key === "string" ? body.idempotency_key : randomUUID();
  const r = await backend.rpc<{ id: string; token: string; expires_at: string }>("create_invitation", {
    p_idempotency_key: key,
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return json({ id: r.id, expires_at: r.expires_at, url: `${base}/invite/${r.token}` });
});
