import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AppError, getBackend, type Backend, type SessionUser } from "@/lib/backend";

export type Handler = (ctx: {
  req: Request;
  backend: Backend;
  user: SessionUser;
  params: Record<string, string>;
}) => Promise<Response>;

/** Wrap a route handler: requires a verified signed-in user, converts AppError/Zod errors to JSON. */
export function withAuth(handler: Handler, opts: { allowUnverified?: boolean } = {}) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      const backend = await getBackend();
      const user = await backend.getUser();
      if (!user) throw new AppError("UNAUTHENTICATED", "Sign in required", 401);
      if (!user.emailVerified && !opts.allowUnverified)
        throw new AppError("UNVERIFIED", "Verify your email to continue", 403);
      return await handler({ req, backend, user, params: await ctx.params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof AppError)
    return NextResponse.json({ error: { code: e.code, message: e.message, hint: e.hint } }, { status: e.status });
  const err = e as { name?: string; issues?: unknown; message?: string };
  if (err.name === "ZodError")
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid input", issues: err.issues } },
      { status: 422 },
    );
  console.error("[api] unhandled", err.message);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw: unknown = await req.json().catch(() => {
    throw new AppError("VALIDATION", "Body must be JSON", 400);
  });
  return schema.parse(raw);
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
