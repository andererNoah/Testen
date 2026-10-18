import type { Database } from "./schema";

type MissingKeys<T, K extends readonly PropertyKey[]> = Exclude<keyof T, K[number]>;

/** Lists every column of a table; fails to compile if one is missing or unknown. */
function columns<T>() {
  return <const K extends readonly (keyof T & string)[]>(
    ...keys: K & ([MissingKeys<T, K>] extends [never] ? unknown : { missing: MissingKeys<T, K> })
  ): readonly string[] => keys;
}

/** Runtime mirror of the Kysely types, compared against the real schema in tests. */
export const TABLE_COLUMNS: { [T in keyof Database]: readonly string[] } = {
  tenants: columns<Database["tenants"]>()("id", "name", "slug", "modules", "settings", "created_at", "updated_at"),
  users: columns<Database["users"]>()("id", "tenant_id", "email", "display_name", "person_id", "status", "created_at", "updated_at"),
  roles: columns<Database["roles"]>()("id", "tenant_id", "key", "name", "description", "permissions", "is_system", "created_at", "updated_at"),
  role_assignments: columns<Database["role_assignments"]>()(
    "id", "tenant_id", "user_id", "role_id", "scope_type", "scope_id", "valid_from", "valid_to", "created_at", "updated_at",
  ),
  properties: columns<Database["properties"]>()(
    "id", "tenant_id", "kind", "code", "name", "street", "house_number", "postal_code", "city", "state", "mea_denominator",
    "voting_principle", "settlement_period_start_month", "custom_fields", "archived_at", "created_at", "updated_at",
  ),
  buildings: columns<Database["buildings"]>()(
    "id", "tenant_id", "property_id", "name", "street", "house_number", "postal_code", "city", "year_built", "usage", "custom_fields",
    "created_at", "updated_at",
  ),
  units: columns<Database["units"]>()(
    "id", "tenant_id", "property_id", "building_id", "number", "type", "floor", "position", "description", "linked_unit_id",
    "custom_fields", "archived_at", "created_at", "updated_at",
  ),
  unit_measures: columns<Database["unit_measures"]>()(
    "id", "tenant_id", "property_id", "unit_id", "measure", "value", "valid_from", "valid_to", "recorded_at", "superseded_at", "source", "note",
  ),
  technical_assets: columns<Database["technical_assets"]>()(
    "id", "tenant_id", "property_id", "building_id", "kind", "name", "installed_on", "energy_carrier", "last_inspection_on",
    "attributes", "created_at", "updated_at",
  ),
  meters: columns<Database["meters"]>()(
    "id", "tenant_id", "property_id", "building_id", "unit_id", "kind", "serial_number", "location", "remote_readable",
    "interoperable", "calibration_valid_until", "installed_on", "created_at", "updated_at",
  ),
  persons: columns<Database["persons"]>()(
    "id", "tenant_id", "kind", "salutation", "title", "first_name", "last_name", "company_name", "birth_date", "email", "phone",
    "mobile", "street", "house_number", "postal_code", "city", "country", "communication_preference", "iban", "phonetic_key",
    "notes", "merged_into_id", "custom_fields", "created_by", "created_at", "updated_at",
  ),
  person_roles: columns<Database["person_roles"]>()(
    "id", "tenant_id", "person_id", "role", "property_id", "unit_id", "valid_from", "valid_to", "share", "note", "created_at", "updated_at",
  ),
  custom_field_definitions: columns<Database["custom_field_definitions"]>()(
    "id", "tenant_id", "entity_type", "key", "label", "field_type", "required", "options", "position", "created_at", "updated_at",
  ),
  audit_log: columns<Database["audit_log"]>()(
    "id", "tenant_id", "occurred_at", "actor_user_id", "actor_kind", "request_id", "table_name", "row_id", "action", "old_data",
    "new_data", "changed_fields", "entry_hash",
  ),
  access_log: columns<Database["access_log"]>()(
    "id", "tenant_id", "occurred_at", "user_id", "entity_type", "entity_id", "action", "request_id", "context",
  ),
  legal_rules: columns<Database["legal_rules"]>()("key", "title", "area", "description", "synced_at"),
  legal_rule_versions: columns<Database["legal_rule_versions"]>()(
    "rule_key", "version", "valid_from", "valid_to", "status", "summary", "params", "sources", "recht_pruefen", "changelog",
  ),
  import_jobs: columns<Database["import_jobs"]>()(
    "id", "tenant_id", "created_by", "status", "source_files", "mapping", "report", "data", "summary", "created_at", "updated_at", "committed_at",
  ),
};
