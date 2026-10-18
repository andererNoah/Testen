import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadPrincipal } from "@hv/access";
import { withTenant, type ActorKind, type Db } from "@hv/db";
import type { IsoDate } from "@hv/deadlines";
import type { DocumentStorage } from "@hv/documents";
import type { Ctx } from "@hv/masterdata";
import { AuthError, type AuthIdentity, type Authenticator } from "../auth";

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
  interface FastifyRequest {
    identity: AuthIdentity | null;
  }
  interface FastifyContextConfig {
    /** Route without authentication (health, OpenAPI, dev login). */
    public?: boolean;
  }
}

export interface AppDeps {
  appDb: Db;
  ownerDb: Db;
  auth: Authenticator;
  storage: DocumentStorage;
  /** Today's civil date in Germany; injectable for tests. */
  today: () => IsoDate;
}

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    if (request.routeOptions.config?.public || !request.routeOptions.url) return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AuthError("Kein Token");
    request.identity = await app.deps.auth.verify(header.slice(7));
  });
}

/** Runs `fn` in a tenant transaction with the caller's principal (one transaction per request). */
export function runInTenant<T>(request: FastifyRequest, fn: (ctx: Ctx) => Promise<T>, options: { actorKind?: ActorKind } = {}): Promise<T> {
  const identity = request.identity;
  if (!identity) throw new AuthError("Nicht angemeldet");
  const { appDb, today } = request.server.deps;
  const context = { tenantId: identity.tenantId, userId: identity.userId, requestId: request.id, actorKind: options.actorKind ?? "user" };
  return withTenant(appDb, context, async (trx) =>
    fn({ trx, principal: await loadPrincipal(trx, identity.userId), today: today(), requestId: request.id }),
  );
}
