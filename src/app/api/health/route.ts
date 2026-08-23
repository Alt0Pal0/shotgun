import { json } from "@/lib/api";
import { backendConfigured, getBackend } from "@/lib/backend";
/** Health + keep-warm: touches the database so Neon's compute stays awake for real users. */
export async function GET() {
  if (!backendConfigured()) return json({ ok: false, reason: "unconfigured" }, { status: 503 });
  try {
    const backend = await getBackend();
    await backend.serviceRpc("skills_list");
    return json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
