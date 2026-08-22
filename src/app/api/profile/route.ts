import { json, withAuth } from "@/lib/api";
import { z } from "zod";
import { parseBody } from "@/lib/api";

const schema = z.object({
  display_name: z.string().trim().min(1).max(60).optional(),
  timezone: z.string().max(60).optional(),
  unit_preference: z.enum(["imperial", "metric"]).optional(),
  age_confirmed: z.boolean().optional(),
  is_adult: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
});

export const PATCH = withAuth(
  async ({ backend, req }) => {
    const body = await parseBody(req, schema);
    return json(await backend.rpc("update_profile", { p: body }));
  },
  { allowUnverified: true },
);

export const DELETE = withAuth(async ({ backend }) => {
  await backend.rpc("delete_my_account");
  await backend.signOut();
  return json({ ok: true });
});
