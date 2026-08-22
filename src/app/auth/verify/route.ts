import { NextResponse } from "next/server";
import { backendMode } from "@/lib/backend";

/** Email verification link target (postgres backend). Supabase deployments use /auth/callback instead. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (backendMode() !== "postgres") return NextResponse.redirect(new URL("/", url.origin));
  const { consumeVerifyToken } = await import("@/lib/backend/postgres");
  const ok = await consumeVerifyToken(url.searchParams.get("token") ?? "");
  const next = url.searchParams.get("next");
  return NextResponse.redirect(
    new URL(ok ? (next && next.startsWith("/") ? next : "/") : "/verify?invalid=1", url.origin),
  );
}
