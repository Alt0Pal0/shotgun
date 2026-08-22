import { redirect } from "next/navigation";
import { backendConfigured } from "@/lib/backend";

export default function SetupPage() {
  if (backendConfigured()) redirect("/");
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY (server only)",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY (optional)",
  ];
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Learner Driver Platform</p>
      <h1 className="mt-2 text-2xl font-bold">Deployment needs a database</h1>
      <p className="mt-2 text-sm text-muted">
        This deployment has no Supabase project configured, so sign-in and data are unavailable. The app is built and
        healthy; it is waiting on configuration.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Create a Supabase project and enable the <strong>PostGIS</strong> extension.
        </li>
        <li>
          Apply <code>supabase/migrations/*.sql</code> in order; add <code>app</code> to API → Exposed schemas.
        </li>
        <li>
          Auth → URL configuration: add <code>/auth/callback</code> on this domain to redirect URLs.
        </li>
        <li>
          Set these environment variables in Vercel and redeploy:
          <ul className="mt-1 list-disc pl-5 text-xs text-muted">
            {vars.map((v) => (
              <li key={v}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </li>
      </ol>
      <p className="mt-4 text-xs text-muted">Full steps: README.md → “Supabase setup” and docs/RELEASE_CHECKLIST.md.</p>
    </main>
  );
}
