import { json, parseBody, withAuth } from "@/lib/api";
import { recorderStatusSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, recorderStatusSchema);
  return json(
    await backend.rpc("report_recorder_status", {
      p_session: params.id,
      p_device: body.device_id,
      p_recorder_state: body.recorder_state,
      p_connectivity: body.connectivity,
      p_battery_warning: body.battery_warning ?? null,
      p_location_permission: body.location_permission ?? null,
    }),
  );
});
