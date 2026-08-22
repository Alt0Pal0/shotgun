import { NextResponse, type NextRequest } from "next/server";

/** Forwards the pathname to server layouts (for nav state) and refreshes Supabase sessions when configured. */
export async function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  let res = NextResponse.next({ request: { headers } });
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createServerClient } = await import("@supabase/ssr");
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all) => { all.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: { headers } }); all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
      },
    });
    await sb.auth.getUser(); // refreshes expired tokens
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)"] };
