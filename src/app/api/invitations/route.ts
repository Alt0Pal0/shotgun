import { randomUUID } from "node:crypto";
import { z } from "zod";
import { json, parseBody, withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
import { sendAuthEmail } from "@/lib/email";
import { BRAND } from "@/lib/brand";
import type { Me } from "@/lib/types";

const schema = z.object({
  idempotency_key: z.string().min(8).max(128).optional(),
  email: z.string().email().max(254).optional(),
});

/**
 * Create a single-use invitation. Optionally email it: the same message goes to new and existing adults (the invite
 * page offers sign-up or sign-in), so the email never reveals whether an account exists.
 */
export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, schema);
  const key = body.idempotency_key ?? randomUUID();
  const r = await backend.rpc<{ id: string; token: string; expires_at: string }>("create_invitation", {
    p_idempotency_key: key,
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const url = `${base}/invite/${r.token}`;
  let emailed = false;
  if (body.email) {
    const me = await backend.rpc<Me>("me");
    const first = me.profile?.display_name?.split(" ")[0] || "A learner driver";
    const sentRecently = me.invitations.filter((i) => Date.now() - Date.parse(i.created_at) < 3600_000).length;
    if (sentRecently > 10)
      throw new AppError("RATE_LIMITED", "Too many invitations in the last hour. Try again later.", 429);
    try {
      await sendAuthEmail(
        body.email,
        `${first} wants you to ride shotgun 🤘`,
        url,
        `${first} is learning to drive and needs a licensed adult in the passenger seat. Accept this invitation on ${BRAND} to link your accounts, confirm drives from your own phone, and approve practice hours. If you don't have an account yet, you can create one in the same step.`,
        "Accept the invitation",
      );
      emailed = true;
      await backend.rpc("track_event", { p_event: "invitation_emailed", p_props: {} }).catch(() => undefined);
    } catch (e) {
      return json({ id: r.id, expires_at: r.expires_at, url, emailed: false, email_error: (e as Error).message });
    }
  }
  return json({ id: r.id, expires_at: r.expires_at, url, emailed });
});
