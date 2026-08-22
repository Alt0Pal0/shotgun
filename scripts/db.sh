#!/usr/bin/env bash
# Local database helper (plain PostgreSQL). Usage: scripts/db.sh reset|migrate [dbname]
set -euo pipefail
CMD=${1:-migrate}; DB=${2:-${LOCAL_DB_NAME:-ldp_dev}}
PSQL="psql -v ON_ERROR_STOP=1 -q"
if [ "$CMD" = "reset" ]; then
  $PSQL -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\""
  $PSQL -d "$DB" -f supabase/local/00_shim.sql
fi
for f in supabase/migrations/*.sql; do
  echo "applying $f"; $PSQL -d "$DB" -f "$f"
done
echo "done: $DB"
