import { json, withAuth } from "@/lib/api";
export const GET = withAuth(async ({ backend }) => json(await backend.rpc("me")), { allowUnverified: true });
