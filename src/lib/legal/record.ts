import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { Backend } from "@/lib/backend";
import { TERMS_VERSION, type LegalDoc } from "./documents";

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Client IP and user agent from the incoming request (Vercel sets x-forwarded-for / x-real-ip). */
export async function requestEvidence(): Promise<{ ip: string | null; user_agent: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = h.get("x-real-ip") ?? (fwd ? fwd.split(",")[0].trim() : null);
  return { ip, user_agent: h.get("user-agent") };
}

/** Append acceptance records for the signed-in user with full evidence. */
export async function recordAcceptances(
  backend: Backend,
  docs: LegalDoc[],
  context: Record<string, unknown> = {},
  setTermsVersion = false,
) {
  const ev = await requestEvidence();
  return backend.rpc("record_legal_acceptance", {
    p: {
      documents: docs.map((d) => ({ key: d.key, version: TERMS_VERSION, sha256: sha256(d.body) })),
      ip: ev.ip,
      user_agent: ev.user_agent,
      context: { ...context, accepted_via: "web" },
      request_id: randomUUID(),
      terms_version: setTermsVersion ? TERMS_VERSION : null,
    },
  });
}
