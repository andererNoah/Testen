import { ConflictError, DomainError, ForbiddenError, ValidationError } from "./errors";

interface PgLikeError {
  code: string;
  constraint?: string;
  detail?: string;
  message: string;
}

function isPgError(error: unknown): error is PgLikeError {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string" && /^[0-9A-Z]{5}$/.test((error as { code: string }).code);
}

/** Readable messages for known constraints; everything else gets a generic text. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  properties_tenant_id_code_key: "Diese Objektnummer ist bereits vergeben.",
  units_property_id_number_key: "Diese Einheitennummer gibt es in diesem Objekt schon.",
  buildings_property_id_name_key: "Ein Gebäude mit diesem Namen gibt es in diesem Objekt schon.",
  meters_tenant_id_kind_serial_number_key: "Ein Zähler dieser Art mit dieser Nummer ist bereits erfasst.",
  users_tenant_id_email_key: "Diese E-Mail-Adresse ist bereits als Benutzer angelegt.",
  custom_field_definitions_tenant_id_entity_type_key_key: "Ein eigenes Feld mit diesem Schlüssel gibt es schon.",
  unit_measures_no_overlap: "Für diesen Zeitraum ist bereits ein Wert erfasst.",
};

/** Translates PostgreSQL errors into domain errors; returns null for unknown errors. */
export function fromPgError(error: unknown): DomainError | null {
  if (error instanceof DomainError) return error;
  if (!isPgError(error)) return null;
  const known = error.constraint ? CONSTRAINT_MESSAGES[error.constraint] : undefined;
  switch (error.code) {
    case "23505":
      return new ConflictError(known ?? "Dieser Eintrag existiert bereits.", { constraint: error.constraint });
    case "23P01":
      return new ConflictError(known ?? "Der Zeitraum überschneidet sich mit einem bestehenden Eintrag.", { constraint: error.constraint });
    case "23503":
      return new ValidationError(known ?? "Ein verknüpfter Datensatz existiert nicht oder gehört nicht zu diesem Objekt.", []);
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
      return new ValidationError(known ?? "Ein Wert ist ungültig.", []);
    case "23502":
      return new ValidationError("Ein Pflichtfeld fehlt.", []);
    case "42501":
      return new ForbiddenError();
    default:
      return null;
  }
}
