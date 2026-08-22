import { execSync } from "node:child_process";

export default function setup() {
  const db = process.env.LOCAL_DB_NAME ?? "ldp_test";
  if (process.env.SKIP_DB_RESET === "1") return;
  execSync(`./scripts/db.sh reset ${db}`, { stdio: "inherit" });
}
