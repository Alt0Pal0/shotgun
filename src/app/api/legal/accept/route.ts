import { json, parseBody, withAuth } from "@/lib/api";
import { z } from "zod";
import { PRIVACY, RISK, TERMS } from "@/lib/legal/documents";
import { recordAcceptances } from "@/lib/legal/record";

/** Re-acceptance for existing accounts when the terms version changes. */
export const POST = withAuth(
  async ({ backend, req }) => {
    const body = await parseBody(req, z.object({ acceptTerms: z.literal(true), acceptRisk: z.literal(true) }));
    void body;
    await recordAcceptances(backend, [TERMS, PRIVACY, RISK], { screen: "accept_terms" }, true);
    return json({ ok: true });
  },
  { allowUnverified: true },
);
