import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";
import { DomainError, fromPgError, type FieldIssue } from "@hv/core";
import { AuthError } from "../auth";

/** RFC 9457 problem details with German, user-facing texts (V12). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  instance: string;
  requestId: string;
  issues?: FieldIssue[];
  [key: string]: unknown;
}

const TITLES: Record<number, string> = {
  400: "Ungültige Anfrage",
  401: "Anmeldung erforderlich",
  403: "Keine Berechtigung",
  404: "Nicht gefunden",
  409: "Konflikt",
  413: "Datei zu groß",
  415: "Dateiformat nicht unterstützt",
  422: "Eingaben prüfen",
  429: "Zu viele Anfragen",
  500: "Interner Fehler",
};

export function sendProblem(reply: FastifyReply, request: FastifyRequest, status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  const problem: Problem = {
    type: `https://docs.hv.invalid/probleme/${code}`,
    title: TITLES[status] ?? "Fehler",
    status,
    detail,
    code,
    instance: request.url,
    requestId: request.id,
    ...extra,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}

function issuePath(instancePath: string, context?: string): string {
  const path = instancePath.replace(/^\//, "").split("/").filter(Boolean).join(".");
  return context && context !== "body" ? `${context}${path ? `.${path}` : ""}` : path;
}

export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => sendProblem(reply, request, 404, "route_not_found", `Die Adresse ${request.method} ${request.url} gibt es nicht.`));

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map((v) => ({ path: issuePath(v.instancePath, error.validationContext), message: v.message ?? "ungültig" }));
      return sendProblem(reply, request, 422, "validation_failed", "Einige Eingaben sind ungültig. Bitte prüfen Sie die markierten Felder.", { issues });
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, issues: error.cause.issues }, "Antwort passt nicht zum Schema");
      return sendProblem(reply, request, 500, "internal_error", "Ein unerwarteter Fehler ist aufgetreten. Wir kümmern uns darum.");
    }
    if (error instanceof AuthError) {
      return sendProblem(reply, request, 401, "unauthenticated", "Ihre Anmeldung ist abgelaufen oder ungültig. Bitte melden Sie sich erneut an.");
    }
    const domain = error instanceof DomainError ? error : fromPgError(error);
    if (domain) {
      const details = (domain.details && typeof domain.details === "object" ? domain.details : {}) as Record<string, unknown>;
      return sendProblem(reply, request, domain.status, domain.code, domain.message, details);
    }
    if (error.statusCode && error.statusCode < 500) {
      return sendProblem(reply, request, error.statusCode, (error.code ?? "bad_request").toLowerCase(), error.message);
    }
    request.log.error({ err: error }, "Unerwarteter Fehler");
    return sendProblem(reply, request, 500, "internal_error", "Ein unerwarteter Fehler ist aufgetreten. Wir kümmern uns darum.");
  });
}
