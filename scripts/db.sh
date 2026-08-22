#!/usr/bin/env bash
# Local database helper. Usage: scripts/db.sh reset|migrate [dbname]
set -euo pipefail
CMD=${1:-migrate}; DB=${2:-${LOCAL_DB_NAME:-ldp_dev}}
if [ "$CMD" = "reset" ]; then
  psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\""
fi
DATABASE_URL="postgres:///$DB" pnpm -s tsx scripts/migrate.ts
