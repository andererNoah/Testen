/**
 * Server for browser tests (Playwright): fresh database with the demo tenant, then the API.
 * Uses TEST_DATABASE_ADMIN_URL if set (CI), otherwise a throwaway local cluster.
 */
import pg from "pg";
import { createDb, createPool, ensureRoles, migrate, quoteIdent } from "@hv/db";
import { startLocalCluster, withCredentials } from "@hv/db/test-support";
import { MemoryStorage } from "@hv/documents";
import { buildApp } from "./app";
import { createAuthenticator } from "./auth";
import { seedDemoTenant } from "./demo-seed";
import { syncRuleCatalog } from "./rules-sync";

const PORT = Number(process.env.HV_E2E_API_PORT ?? 3100);
const DB = "hv_e2e";
const TODAY = process.env.HV_E2E_TODAY ?? "2026-10-18";
const passwords = { owner: "hv_owner_test", app: "hv_app_test" };

const cluster = process.env.TEST_DATABASE_ADMIN_URL ? null : await startLocalCluster({ port: Number(process.env.HV_E2E_PG_PORT ?? 54331) });
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? cluster!.adminUrl;
await ensureRoles(adminUrl, passwords);
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(DB)} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${quoteIdent(DB)} OWNER hv_owner`);
await admin.end();

const ownerUrl = withCredentials(adminUrl, "hv_owner", passwords.owner, DB);
await migrate(ownerUrl);
const ownerDb = createDb(createPool(ownerUrl, { max: 2 }));
const appDb = createDb(createPool(withCredentials(adminUrl, "hv_app", passwords.app, DB)));
await syncRuleCatalog(ownerDb);
await seedDemoTenant(ownerDb, appDb, TODAY);

const app = await buildApp({
  deps: {
    appDb,
    ownerDb,
    storage: new MemoryStorage(),
    auth: createAuthenticator({ AUTH_DEV_SECRET: "e2e-secret-e2e-secret-e2e-secret-0001", AUTH_ISSUER: "hv-dev", AUTH_AUDIENCE: "hv-api", NODE_ENV: "test" }),
    today: () => TODAY,
  },
});
const stop = async () => {
  await app.close();
  await appDb.destroy();
  await ownerDb.destroy();
  await cluster?.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
await app.listen({ host: "127.0.0.1", port: PORT });
console.log(`E2E-API bereit auf http://127.0.0.1:${PORT}`);
