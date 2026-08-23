/**
 * Next.js instrumentation hook. When AUTO_MIGRATE=1, applies pending migrations at server boot.
 * Fire-and-forget with a timeout: requests never wait on it (the schema is normally already current).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AUTO_MIGRATE !== "1") return;
  const { databaseUrl } = await import("@/lib/backend");
  const url = databaseUrl();
  if (!url) return;
  const started = Date.now();
  void (async () => {
    const { runMigrations } = await import("@/lib/migrate");
    try {
      const n = await Promise.race([
        runMigrations(url, (m) => console.log(`[migrate] ${m}`)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout after 45s")), 45_000)),
      ]);
      console.log(`[migrate] ${n ? `applied ${n}` : "up to date"} in ${Date.now() - started}ms`);
    } catch (e) {
      console.error("[migrate] skipped:", (e as Error).message);
    }
  })();
}
