import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";
import { createDb, createPool, quoteIdent, type Db } from "../src/index";
import { withCredentials } from "./cluster";
import "./provided";

export interface TestDatabase {
  name: string;
  /** Connection as hv_owner: bypasses RLS. For fixtures and assertions only. */
  ownerDb: Db;
  /** Connection as hv_app: subject to RLS, like the application. */
  appDb: Db;
  ownerUrl: string;
  appUrl: string;
  destroy(): Promise<void>;
}

/** Creates an isolated database from the migrated template (one per test file). */
export async function createTestDatabase(): Promise<TestDatabase> {
  const cfg = inject("pg");
  const name = `hv_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const admin = new pg.Client({ connectionString: cfg.adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${quoteIdent(name)} TEMPLATE ${quoteIdent(cfg.template)} OWNER hv_owner`);
  } finally {
    await admin.end();
  }
  const ownerUrl = withCredentials(cfg.adminUrl, "hv_owner", cfg.ownerPassword, name);
  const appUrl = withCredentials(cfg.adminUrl, "hv_app", cfg.appPassword, name);
  const ownerDb = createDb(createPool(ownerUrl, { max: 4, applicationName: "hv-test-owner" }));
  const appDb = createDb(createPool(appUrl, { max: 4, applicationName: "hv-test-app" }));
  return {
    name,
    ownerDb,
    appDb,
    ownerUrl,
    appUrl,
    async destroy() {
      await ownerDb.destroy();
      await appDb.destroy();
      const c = new pg.Client({ connectionString: cfg.adminUrl });
      await c.connect();
      try {
        await c.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
      } finally {
        await c.end();
      }
    },
  };
}

export { startLocalCluster, withCredentials } from "./cluster";
