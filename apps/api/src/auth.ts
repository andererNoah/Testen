import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Config } from "./config";

export interface AuthIdentity {
  userId: string;
  tenantId: string;
}

export class AuthError extends Error {
  override name = "AuthError";
}

export interface Authenticator {
  verify(token: string): Promise<AuthIdentity>;
  /** Only with AUTH_DEV_SECRET outside production (ADR-0009). */
  issueDevToken?: (identity: AuthIdentity) => Promise<string>;
}

function identityFrom(payload: JWTPayload): AuthIdentity {
  const tenantId = payload.tid;
  if (typeof payload.sub !== "string" || typeof tenantId !== "string") throw new AuthError("Token ohne Benutzer oder Mandant");
  return { userId: payload.sub, tenantId };
}

export function createAuthenticator(config: Pick<Config, "AUTH_DEV_SECRET" | "AUTH_JWKS_URL" | "AUTH_ISSUER" | "AUTH_AUDIENCE" | "NODE_ENV">): Authenticator {
  const options = { issuer: config.AUTH_ISSUER, audience: config.AUTH_AUDIENCE };
  if (config.AUTH_JWKS_URL) {
    const jwks = createRemoteJWKSet(new URL(config.AUTH_JWKS_URL));
    return {
      async verify(token) {
        try {
          return identityFrom((await jwtVerify(token, jwks, options)).payload);
        } catch (error) {
          throw new AuthError((error as Error).message);
        }
      },
    };
  }
  const secret = new TextEncoder().encode(config.AUTH_DEV_SECRET);
  return {
    async verify(token) {
      try {
        return identityFrom((await jwtVerify(token, secret, { ...options, algorithms: ["HS256"] })).payload);
      } catch (error) {
        throw new AuthError((error as Error).message);
      }
    },
    ...(config.NODE_ENV !== "production"
      ? {
          issueDevToken: (identity: AuthIdentity) =>
            new SignJWT({ tid: identity.tenantId })
              .setProtectedHeader({ alg: "HS256" })
              .setSubject(identity.userId)
              .setIssuer(config.AUTH_ISSUER)
              .setAudience(config.AUTH_AUDIENCE)
              .setIssuedAt()
              .setExpirationTime("8h")
              .sign(secret),
        }
      : {}),
  };
}
