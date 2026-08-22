/** Next.js instrumentation hook: runs pending migrations at server boot when AUTO_MIGRATE=1 (Neon/Vercel convenience). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AUTO_MIGRATE !== "1" || !process.env.DATABASE_URL) return;
  const { runMigrations } = await import("@/lib/migrate");
  try {
    const n = await runMigrations(process.env.DATABASE_URL, (m) => console.log(`[migrate] ${m}`));
    if (n) console.log(`[migrate] applied ${n} migration(s)`);
  } catch (e) {
    console.error("[migrate] failed", e);
  }
}
