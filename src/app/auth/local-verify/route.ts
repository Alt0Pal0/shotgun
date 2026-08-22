import { NextResponse } from "next/server";
import { backendMode } from "@/lib/backend";

/** Local-backend only: simulates clicking the verification email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (backendMode() !== "local") return NextResponse.redirect(new URL("/", url.origin));
  const { localVerifyEmail } = await import("@/lib/backend/local");
  const ok = await localVerifyEmail(url.searchParams.get("token") ?? "");
  const next = url.searchParams.get("next");
  return NextResponse.redirect(new URL(ok ? (next && next.startsWith("/") ? next : "/") : "/verify", url.origin));
}
