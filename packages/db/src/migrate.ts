import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export class MigrationChecksumError extends Error {
  override name = "MigrationChecksumError";
}

/**
 * Applies pending SQL migrations in file name order, each in its own transaction.
 * Must run as the owner role (hv_owner). Applied files must not change (checksum).
 */
export async function migrate(connectionString: string, dir = MIGRATIONS_DIR): Promise<MigrationResult> {
  const client = new pg.Client({ connectionString, application_name: "hv-migrate" });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    // Serialise concurrent migration runs.
    await client.query("SELECT pg_advisory_lock(727274)");
    const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    const { rows } = await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations");
    const done = new Map(rows.map((r) => [r.version, r.checksum]));
    const result: MigrationResult = { applied: [], skipped: [] };
    for (const file of files) {
      const content = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(content).digest("hex");
      const previous = done.get(file);
      if (previous) {
        if (previous !== checksum) throw new MigrationChecksumError(`Migration ${file} wurde nach dem Einspielen verändert.`);
        result.skipped.push(file);
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(content);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
        result.applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} fehlgeschlagen: ${(error as Error).message}`, { cause: error });
      }
    }
    await client.query("SELECT pg_advisory_unlock(727274)");
    return result;
  } finally {
    await client.end();
  }
}
