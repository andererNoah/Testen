import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

/** Kysely table types. Must match the SQL migrations (checked by test/schema.test.ts). */

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type DateString = string; // DATE columns are kept as `YYYY-MM-DD` strings
type Json<T = Record<string, unknown>> = ColumnType<T, T | string | undefined, T | string>;
type JsonArray<T = unknown> = ColumnType<T[], T[] | string | undefined, T[] | string>;
type Numeric = ColumnType<string, string | number, string | number>;

export type PropertyKind = "weg" | "rental" | "sev";
export type UnitType = "apartment" | "commercial" | "parking" | "garage" | "ancillary";
export type MeasureKind = "living_area" | "usable_area" | "heated_area" | "mea" | "persons";
export type ScopeType = "tenant" | "property" | "unit";
export type PersonRoleKind = "eigentuemer" | "mieter" | "mitmieter" | "beirat" | "dienstleister" | "buerge" | "bevollmaechtigter";
export type AssetKind = "heating" | "drinking_water" | "elevator" | "smoke_detectors" | "energy_certificate" | "other";
export type EnergyCarrier = "gas" | "oil" | "lpg" | "district_heating" | "heat_pump" | "biomass" | "electric" | "solar" | "other";
export type MeterKind = "heat" | "hot_water" | "cold_water" | "gas" | "electricity" | "hcd";
export type CustomFieldEntity = "property" | "building" | "unit" | "person";
export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";

export interface TenantsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  modules: ColumnType<string[], string[] | undefined, string[]>;
  settings: Json;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UsersTable {
  id: Generated<string>;
  tenant_id: string;
  email: string;
  display_name: string;
  person_id: string | null;
  status: ColumnType<"active" | "invited" | "disabled", "active" | "invited" | "disabled" | undefined>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RolesTable {
  id: Generated<string>;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: ColumnType<string[], string[] | undefined, string[]>;
  is_system: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RoleAssignmentsTable {
  id: Generated<string>;
  tenant_id: string;
  user_id: string;
  role_id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  valid_from: ColumnType<DateString, DateString | undefined, DateString>;
  valid_to: DateString | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PropertiesTable {
  id: Generated<string>;
  tenant_id: string;
  kind: PropertyKind;
  code: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  mea_denominator: number | null;
  voting_principle: "head" | "value" | "object" | null;
  settlement_period_start_month: ColumnType<number, number | undefined, number>;
  custom_fields: Json;
  archived_at: Timestamp | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface BuildingsTable {
  id: Generated<string>;
  tenant_id: string;
  property_id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  year_built: number | null;
  usage: ColumnType<"residential" | "non_residential" | "mixed", "residential" | "non_residential" | "mixed" | undefined>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UnitsTable {
  id: Generated<string>;
  tenant_id: string;
  property_id: string;
  building_id: string | null;
  number: string;
  type: UnitType;
  floor: string | null;
  position: string | null;
  description: string | null;
  linked_unit_id: string | null;
  custom_fields: Json;
  archived_at: Timestamp | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UnitMeasuresTable {
  id: Generated<string>;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  measure: MeasureKind;
  value: Numeric;
  valid_from: DateString;
  valid_to: DateString | null;
  recorded_at: Generated<Date>;
  superseded_at: Timestamp | null;
  source: string | null;
  note: string | null;
}

export interface TechnicalAssetsTable {
  id: Generated<string>;
  tenant_id: string;
  property_id: string;
  building_id: string | null;
  kind: AssetKind;
  name: string;
  installed_on: DateString | null;
  energy_carrier: EnergyCarrier | null;
  last_inspection_on: DateString | null;
  attributes: Json;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MetersTable {
  id: Generated<string>;
  tenant_id: string;
  property_id: string;
  building_id: string | null;
  unit_id: string | null;
  kind: MeterKind;
  serial_number: string;
  location: string | null;
  remote_readable: ColumnType<boolean, boolean | undefined, boolean>;
  interoperable: ColumnType<boolean, boolean | undefined, boolean>;
  calibration_valid_until: DateString | null;
  installed_on: DateString | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PersonsTable {
  id: Generated<string>;
  tenant_id: string;
  kind: "natural" | "legal";
  salutation: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  birth_date: DateString | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: ColumnType<string, string | undefined, string>;
  communication_preference: ColumnType<"email" | "letter" | "portal", "email" | "letter" | "portal" | undefined>;
  iban: string | null;
  phonetic_key: string | null;
  notes: string | null;
  merged_into_id: string | null;
  custom_fields: Json;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PersonRolesTable {
  id: Generated<string>;
  tenant_id: string;
  person_id: string;
  role: PersonRoleKind;
  property_id: string;
  unit_id: string | null;
  valid_from: DateString | null;
  valid_to: DateString | null;
  share: string | null;
  note: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CustomFieldDefinitionsTable {
  id: Generated<string>;
  tenant_id: string;
  entity_type: CustomFieldEntity;
  key: string;
  label: string;
  field_type: CustomFieldType;
  required: ColumnType<boolean, boolean | undefined, boolean>;
  options: JsonArray<string>;
  position: ColumnType<number, number | undefined, number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AuditLogTable {
  id: Generated<number>;
  tenant_id: string | null;
  occurred_at: Generated<Date>;
  actor_user_id: string | null;
  actor_kind: "user" | "system" | "import";
  request_id: string | null;
  table_name: string;
  row_id: string | null;
  action: "insert" | "update" | "delete";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  entry_hash: string | null;
}

export interface AccessLogTable {
  id: Generated<number>;
  tenant_id: string;
  occurred_at: Generated<Date>;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: "read" | "export";
  request_id: string | null;
  context: Json;
}

export interface LegalRulesTable {
  key: string;
  title: string;
  area: string;
  description: string;
  synced_at: Generated<Date>;
}

export interface LegalRuleVersionsTable {
  rule_key: string;
  version: string;
  valid_from: DateString;
  valid_to: DateString | null;
  status: "in_kraft" | "beschlossen" | "entwurf" | "deaktiviert";
  summary: string;
  params: Json<unknown>;
  sources: Json<unknown>;
  recht_pruefen: ColumnType<string[], string[] | undefined, string[]>;
  changelog: string | null;
}

export interface ImportJobsTable {
  id: Generated<string>;
  tenant_id: string;
  created_by: string;
  status: "analyzed" | "validated" | "committed" | "failed";
  source_files: Json<unknown>;
  mapping: Json<unknown>;
  report: Json<unknown> | null;
  data: Json<unknown>;
  summary: Json<unknown> | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  committed_at: Timestamp | null;
}

export interface Database {
  tenants: TenantsTable;
  users: UsersTable;
  roles: RolesTable;
  role_assignments: RoleAssignmentsTable;
  properties: PropertiesTable;
  buildings: BuildingsTable;
  units: UnitsTable;
  unit_measures: UnitMeasuresTable;
  technical_assets: TechnicalAssetsTable;
  meters: MetersTable;
  persons: PersonsTable;
  person_roles: PersonRolesTable;
  custom_field_definitions: CustomFieldDefinitionsTable;
  audit_log: AuditLogTable;
  access_log: AccessLogTable;
  legal_rules: LegalRulesTable;
  legal_rule_versions: LegalRuleVersionsTable;
  import_jobs: ImportJobsTable;
}

export type Row<T extends keyof Database> = Selectable<Database[T]>;
export type NewRow<T extends keyof Database> = Insertable<Database[T]>;
export type RowUpdate<T extends keyof Database> = Updateable<Database[T]>;
