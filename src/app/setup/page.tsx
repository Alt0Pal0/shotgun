import { redirect } from "next/navigation";
import { backendConfigured, databaseUrl } from "@/lib/backend";
import { BRAND_HORNS } from "@/lib/brand";

export default function SetupPage() {
  if (backendConfigured()) redirect("/");
  const hasDb = Boolean(databaseUrl());
  const hasSecret = (process.env.AUTH_SECRET?.length ?? 0) >= 32;
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{BRAND_HORNS}</p>
      <h1 className="mt-2 text-2xl font-bold">Almost there — configuration needed</h1>
      <p className="mt-2 text-sm text-muted">
        The app is built and healthy but is missing environment variables. Set them in Vercel → Project → Settings →
        Environment Variables, then redeploy.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className={hasDb ? "text-success" : "text-rose"}>
          {hasDb ? "✓" : "✗"} <code>DATABASE_URL</code> — Neon Postgres (Vercel → Storage → Neon creates it
          automatically)
        </li>
        <li className={hasSecret ? "text-success" : "text-rose"}>
          {hasSecret ? "✓" : "✗"} <code>AUTH_SECRET</code> — 32+ random characters (<code>openssl rand -hex 32</code>)
        </li>
        <li className="text-muted">
          • <code>AUTO_MIGRATE=1</code> — applies the database schema on first boot (recommended)
        </li>
        <li className="text-muted">
          • <code>NEXT_PUBLIC_APP_URL</code> — this site&apos;s https URL (used in invitation and email links)
        </li>
        <li className="text-muted">
          • <code>RESEND_API_KEY</code> for verification emails, or <code>ALLOW_INSECURE_VERIFY_LINK=1</code> to show
          links on screen during the closed beta
        </li>
        <li className="text-muted">
          • <code>NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> (optional; an offline map renders without it)
        </li>
      </ul>
      <p className="mt-4 text-xs text-muted">Details: README.md → “Deploy on Vercel + Neon”.</p>
    </main>
  );
}
