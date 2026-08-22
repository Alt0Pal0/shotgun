import { errorResponse, json } from "@/lib/api";
import { getBackend } from "@/lib/backend";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const backend = await getBackend();
    const r = await backend.rpc("preview_invitation", { p_token: token });
    return json(r);
  } catch (e) { return errorResponse(e); }
}
