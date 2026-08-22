/**
 * DATABASE_URL=postgres://... pnpm db:migrate
 * Applies supabase/migrations/*.sql in order, once each (public.schema_migrations). Works for Neon, local Postgres,
 * and Supabase direct connections.
 */
import { runMigrations } from "../src/lib/migrate";

const url = process.env.DATABASE_URL ?? `postgres:///${process.env.LOCAL_DB_NAME ?? "ldp_dev"}`;
runMigrations(url, (m) => console.log(m))
  .then((n) => console.log(n ? `applied ${n} migration(s)` : "up to date"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
