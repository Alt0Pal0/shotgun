import { json, parseBody, withAuth } from "@/lib/api";
import { analyticsSchema } from "@/lib/validation/schemas";

const FORBIDDEN_KEYS = /lat|lng|lon|coord|position|route|address/i;
export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, analyticsSchema);
  // Privacy guard: analytics never carry precise location, reflections, or feedback.
  const props = Object.fromEntries(Object.entries(body.properties).filter(([k]) => !FORBIDDEN_KEYS.test(k)));
  await backend.rpc("track_event", { p_event: body.event, p_props: props });
  return json({ ok: true });
});
