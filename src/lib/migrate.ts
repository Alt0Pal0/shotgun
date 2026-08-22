import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Applies pending SQL migrations (supabase/migrations/*.sql) once each, tracked in public.schema_migrations.
 * Safe under concurrency (advisory lock) and idempotent. Used by scripts/migrate.ts and, when AUTO_MIGRATE=1,
 * at server startup so a fresh Neon database needs no manual step.
 */
export async function runMigrations(databaseUrl: string, log: (m: string) => void = () => undefined): Promise<number> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(7261_0001)");
    await client.query(
      "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const applied = new Set(
      (await client.query<{ name: string }>("select name from public.schema_migrations")).rows.map((r) => r.name),
    );
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    let n = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      log(`applying ${f}`);
      try {
        await client.query("begin");
        await client.query(readFileSync(path.join(dir, f), "utf8"));
        await client.query("insert into public.schema_migrations (name) values ($1)", [f]);
        await client.query("commit");
        n++;
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
    await client.query("select pg_advisory_unlock(7261_0001)");
    return n;
  } finally {
    await client.end();
  }
}
