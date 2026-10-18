import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./schema";

const { types } = pg;

function parseSafeInteger(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError(`Ganzzahl außerhalb des sicheren Bereichs: ${value}`);
  return n;
}

const parsers: Record<number, (value: string) => unknown> = {
  // DATE stays a civil date string; JS Date would shift it by the local time zone.
  [types.builtins.DATE]: (value) => value,
  // BIGINT (cents, ids) as number with overflow check (ADR-0004).
  [types.builtins.INT8]: parseSafeInteger,
  // NUMERIC stays a string (exact decimal).
  [types.builtins.NUMERIC]: (value) => value,
};

export const typeOverrides = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    return parsers[oid] ?? types.getTypeParser(oid, format as "text");
  },
};

export interface PoolOptions {
  max?: number;
  applicationName?: string;
}

export function createPool(connectionString: string, options: PoolOptions = {}): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName ?? "hv",
    types: typeOverrides,
  });
}

export function createDb(pool: pg.Pool): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

export type Db = Kysely<Database>;
