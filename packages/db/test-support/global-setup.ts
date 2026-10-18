import type { TestProject } from "vitest/node";
import pg from "pg";
import { ensureRoles, migrate, quoteIdent } from "../src/index";
import { startLocalCluster, withCredentials } from "./cluster";

export const TEST_PASSWORDS = { owner: "hv_owner_test", app: "hv_app_test" };
export const TEMPLATE_DB = "hv_test_template";

import "./provided";

export default async function setup(project: TestProject) {
  const cluster = process.env.TEST_DATABASE_ADMIN_URL ? null : await startLocalCluster();
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? cluster!.adminUrl;

  await ensureRoles(adminUrl, TEST_PASSWORDS);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(TEMPLATE_DB)} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${quoteIdent(TEMPLATE_DB)} OWNER hv_owner`);
  } finally {
    await admin.end();
  }
  await migrate(withCredentials(adminUrl, "hv_owner", TEST_PASSWORDS.owner, TEMPLATE_DB));

  project.provide("pg", { adminUrl, template: TEMPLATE_DB, ownerPassword: TEST_PASSWORDS.owner, appPassword: TEST_PASSWORDS.app });

  return async () => {
    await cluster?.stop();
  };
}
