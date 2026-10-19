/**
 * Local development database (no hosting in Phase 0).
 *   pnpm db:start  – start cluster on 127.0.0.1:54320, create roles and database, migrate
 *   pnpm db:stop   – stop the cluster
 */
import path from "node:path";
import { ensureDatabase, ensureRoles, migrate } from "@hv/db";
import { startLocalCluster, withCredentials } from "@hv/db/test-support";

const PORT = Number(process.env.HV_DEV_PG_PORT ?? 54320);
const dataDir = path.resolve(import.meta.dirname, "../.data/pg");
const passwords = { owner: "hv_owner_dev", app: "hv_app_dev" };

const command = process.argv[2] ?? "start";
const cluster = await startLocalCluster({ dataDir, port: PORT });

if (command === "stop") {
  const { execFileSync } = await import("node:child_process");
  const bin = process.env.PG_BIN ?? execFileSync("pg_config", ["--bindir"]).toString().trim();
  const args = ["-D", dataDir, "-m", "fast", "-w", "stop"];
  if (process.getuid?.() === 0) execFileSync("runuser", ["-u", "postgres", "--", path.join(bin, "pg_ctl"), ...args]);
  else execFileSync(path.join(bin, "pg_ctl"), args);
  console.log("Datenbank gestoppt.");
} else {
  await ensureRoles(cluster.adminUrl, passwords);
  await ensureDatabase(cluster.adminUrl, "hv");
  const ownerUrl = withCredentials(cluster.adminUrl, "hv_owner", passwords.owner, "hv");
  const result = await migrate(ownerUrl);
  console.log(`Datenbank läuft auf 127.0.0.1:${PORT}. Neue Migrationen: ${result.applied.length ? result.applied.join(", ") : "keine"}`);
  console.log("In .env eintragen (siehe .env.example):");
  console.log(`DATABASE_URL=${withCredentials(cluster.adminUrl, "hv_app", passwords.app, "hv")}`);
  console.log(`DATABASE_OWNER_URL=${ownerUrl}`);
}
