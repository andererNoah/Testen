import pg from "pg";

export interface RolePasswords {
  owner: string;
  app: string;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Creates the two database roles (ADR-0003) if missing. Needs a superuser connection.
 * hv_owner owns the schema and bypasses RLS (migrations, platform tasks);
 * hv_app is used by the application and is always subject to RLS.
 */
export async function ensureRoles(adminConnectionString: string, passwords: RolePasswords): Promise<void> {
  const client = new pg.Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    const existing = new Set((await client.query<{ rolname: string }>("SELECT rolname FROM pg_roles WHERE rolname IN ('hv_owner', 'hv_app')")).rows.map((r) => r.rolname));
    const lit = (s: string) => client.escapeLiteral(s);
    if (!existing.has("hv_owner")) await client.query("CREATE ROLE hv_owner");
    if (!existing.has("hv_app")) await client.query("CREATE ROLE hv_app");
    // Re-applied on every run so the attributes cannot drift.
    await client.query(`ALTER ROLE hv_owner LOGIN BYPASSRLS CREATEDB NOSUPERUSER PASSWORD ${lit(passwords.owner)}`);
    await client.query(`ALTER ROLE hv_app LOGIN NOBYPASSRLS NOCREATEDB NOSUPERUSER PASSWORD ${lit(passwords.app)}`);
  } finally {
    await client.end();
  }
}

/** Creates a database owned by hv_owner (no-op if it exists). */
export async function ensureDatabase(adminConnectionString: string, name: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await client.query(`CREATE DATABASE ${quoteIdent(name)} OWNER hv_owner`);
  } finally {
    await client.end();
  }
}

export { quoteIdent };
