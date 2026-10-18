import type { FastifyInstance, InjectOptions } from "fastify";
import type { TestDatabase } from "@hv/db/test-support";
import { MemoryStorage } from "@hv/documents";
import { buildApp, type BuildAppOptions } from "../src/app";
import { createAuthenticator } from "../src/auth";

export const TEST_SECRET = "test-secret-test-secret-test-secret-42";

export async function buildTestApp(t: TestDatabase, plugins: BuildAppOptions["plugins"] = [], today = "2026-10-18") {
  const auth = createAuthenticator({ AUTH_DEV_SECRET: TEST_SECRET, AUTH_ISSUER: "hv-dev", AUTH_AUDIENCE: "hv-api", NODE_ENV: "test" });
  const storage = new MemoryStorage();
  const app = await buildApp({ deps: { appDb: t.appDb, ownerDb: t.ownerDb, auth, storage, today: () => today }, plugins });
  await app.ready();
  return { app, storage, token: (userId: string, tenantId: string) => auth.issueDevToken!({ userId, tenantId }) };
}

export function client(app: FastifyInstance, token: string) {
  const call = (method: InjectOptions["method"], url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  return {
    get: (url: string) => call("GET", url),
    post: (url: string, payload?: unknown) => call("POST", url, payload ?? {}),
    patch: (url: string, payload: unknown) => call("PATCH", url, payload),
  };
}
