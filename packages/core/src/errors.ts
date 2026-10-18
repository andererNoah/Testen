/**
 * Domain errors with a stable machine code and an HTTP status. Messages are German and
 * written for end users (V12: verständliche Fehlermeldungen).
 */
export class DomainError extends Error {
  override name = "DomainError";
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  override name = "NotFoundError";
  constructor(entity: string, id?: string) {
    super("not_found", 404, id ? `${entity} nicht gefunden.` : `${entity} nicht gefunden.`, id ? { entity, id } : { entity });
  }
}

export interface FieldIssue {
  path: string;
  message: string;
}

export class ValidationError extends DomainError {
  override name = "ValidationError";
  constructor(
    message: string,
    readonly issues: FieldIssue[] = [],
  ) {
    super("validation_failed", 422, message, { issues });
  }
}

export class ConflictError extends DomainError {
  override name = "ConflictError";
  constructor(message: string, details?: unknown) {
    super("conflict", 409, message, details);
  }
}

export class ForbiddenError extends DomainError {
  override name = "ForbiddenError";
  constructor(message = "Dafür fehlt Ihnen die Berechtigung.", details?: unknown) {
    super("forbidden", 403, message, details);
  }
}
