/** Writes the OpenAPI document without a database (for typed web clients and API docs). */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@hv/db";
import { MemoryStorage } from "@hv/documents";
import { buildApp } from "./app";
import { createAuthenticator } from "./auth";

const target = process.argv[2] ?? path.resolve(import.meta.dirname, "../../web/src/api/openapi.json");
const unused = new Proxy({}, { get: () => () => Promise.reject(new Error("keine Datenbank")) }) as unknown as Db;
const app = await buildApp({
  deps: {
    appDb: unused,
    ownerDb: unused,
    storage: new MemoryStorage(),
    auth: createAuthenticator({ AUTH_DEV_SECRET: "x".repeat(32), AUTH_ISSUER: "hv-dev", AUTH_AUDIENCE: "hv-api", NODE_ENV: "development" }),
    today: () => "2026-01-01",
  },
});
await app.ready();
await writeFile(target, JSON.stringify(app.swagger(), null, 2) + "\n");
await app.close();
console.log(`OpenAPI geschrieben: ${target}`);
