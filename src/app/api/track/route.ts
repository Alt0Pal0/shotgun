import { json, parseBody, withAuth } from "@/lib/api";
import { licenseTrackSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, licenseTrackSchema);
  const id = await backend.rpc<string>("create_license_track", { p_jurisdiction: body.jurisdiction, p_permit_issue_date: body.permitIssueDate });
  return json({ id });
});
