import { z } from "zod";
import { FEDERAL_STATES, isValidDate } from "@hv/deadlines";
import { isValidIban, normalizeIban } from "./iban";

/** Input and output schemas. Shared by the API for validation and OpenAPI (ADR-0002). */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT angeben")
  .refine(isValidDate, "Dieses Datum gibt es nicht");

const text = (max = 200) => z.string().trim().min(1).max(max);
const optionalText = (max = 200) => z.string().trim().max(max).nullable().optional();
const postalCode = z.string().trim().regex(/^\d{5}$/, "Postleitzahl hat fünf Ziffern").nullable().optional();
export const federalState = z.enum(FEDERAL_STATES);
export const customFieldValues = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

/** Decimal with at most four places, as string (no floating point). */
export const decimalValue = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim().replace(",", ".")))
  .refine((v) => /^\d{1,10}(\.\d{1,4})?$/.test(v), "Zahl mit höchstens vier Nachkommastellen, nicht negativ");

export const propertyKind = z.enum(["weg", "rental", "sev"]);
export const unitType = z.enum(["apartment", "commercial", "parking", "garage", "ancillary"]);
export const measureKind = z.enum(["living_area", "usable_area", "heated_area", "mea", "persons"]);
export const personRoleKind = z.enum(["eigentuemer", "mieter", "mitmieter", "beirat", "dienstleister", "buerge", "bevollmaechtigter"]);
export const assetKind = z.enum(["heating", "drinking_water", "elevator", "smoke_detectors", "energy_certificate", "other"]);
export const energyCarrier = z.enum(["gas", "oil", "lpg", "district_heating", "heat_pump", "biomass", "electric", "solar", "other"]);
export const meterKind = z.enum(["heat", "hot_water", "cold_water", "gas", "electricity", "hcd"]);

// ---------- Properties ----------

export const propertyCreate = z.object({
  kind: propertyKind,
  code: text(30),
  name: text(200),
  street: optionalText(),
  houseNumber: optionalText(20),
  postalCode,
  city: optionalText(),
  state: federalState.nullable().optional(),
  meaDenominator: z.number().int().positive().nullable().optional(),
  votingPrinciple: z.enum(["head", "value", "object"]).nullable().optional(),
  settlementPeriodStartMonth: z.number().int().min(1).max(12).optional(),
  customFields: customFieldValues.optional(),
});
export const propertyUpdate = propertyCreate.omit({ kind: true }).partial();
export type PropertyCreate = z.infer<typeof propertyCreate>;
export type PropertyUpdate = z.infer<typeof propertyUpdate>;

export const property = z.object({
  id: z.string().uuid(),
  kind: propertyKind,
  code: z.string(),
  name: z.string(),
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  meaDenominator: z.number().nullable(),
  votingPrinciple: z.string().nullable(),
  settlementPeriodStartMonth: z.number(),
  customFields: z.record(z.string(), z.unknown()),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Property = z.infer<typeof property>;

// ---------- Buildings ----------

export const buildingCreate = z.object({
  name: text(100),
  street: optionalText(),
  houseNumber: optionalText(20),
  postalCode,
  city: optionalText(),
  yearBuilt: z.number().int().min(1000).max(2100).nullable().optional(),
  usage: z.enum(["residential", "non_residential", "mixed"]).optional(),
  customFields: customFieldValues.optional(),
});
export const buildingUpdate = buildingCreate.partial();
export type BuildingCreate = z.infer<typeof buildingCreate>;

export const building = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  name: z.string(),
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  yearBuilt: z.number().nullable(),
  usage: z.string(),
  customFields: z.record(z.string(), z.unknown()),
});
export type Building = z.infer<typeof building>;

// ---------- Units and measures ----------

export const measureInput = z.object({
  measure: measureKind,
  value: decimalValue,
  validFrom: isoDate,
  validTo: isoDate.nullable().optional(),
  source: optionalText(200),
  note: optionalText(500),
});
export type MeasureInput = z.infer<typeof measureInput>;

export const unitCreate = z.object({
  buildingId: z.string().uuid().nullable().optional(),
  number: text(30),
  type: unitType,
  floor: optionalText(30),
  position: optionalText(60),
  description: optionalText(500),
  linkedUnitId: z.string().uuid().nullable().optional(),
  customFields: customFieldValues.optional(),
  measures: z.array(measureInput).optional(),
});
export const unitUpdate = unitCreate.omit({ measures: true }).partial();
export type UnitCreate = z.infer<typeof unitCreate>;
export type UnitUpdate = z.infer<typeof unitUpdate>;

export const measureValue = z.object({
  measure: measureKind,
  value: z.string(),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  recordedAt: z.string(),
  supersededAt: z.string().nullable(),
  source: z.string().nullable(),
  note: z.string().nullable(),
});
export type MeasureValue = z.infer<typeof measureValue>;

export const unit = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  buildingId: z.string().uuid().nullable(),
  number: z.string(),
  type: unitType,
  floor: z.string().nullable(),
  position: z.string().nullable(),
  description: z.string().nullable(),
  linkedUnitId: z.string().uuid().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  /** Values valid on the requested date (default: today). */
  measures: z.record(z.string(), z.string()),
});
export type Unit = z.infer<typeof unit>;

// ---------- Persons ----------

const personBase = z.object({
  kind: z.enum(["natural", "legal"]),
  salutation: optionalText(30),
  title: optionalText(30),
  firstName: optionalText(100),
  lastName: optionalText(100),
  companyName: optionalText(200),
  birthDate: isoDate.nullable().optional(),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse").nullable().optional(),
  phone: optionalText(40),
  mobile: optionalText(40),
  street: optionalText(),
  houseNumber: optionalText(20),
  postalCode: optionalText(10),
  city: optionalText(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  communicationPreference: z.enum(["email", "letter", "portal"]).optional(),
  iban: z
    .string()
    .transform(normalizeIban)
    .refine(isValidIban, "IBAN ist ungültig (Prüfziffer)")
    .nullable()
    .optional(),
  notes: optionalText(2000),
  customFields: customFieldValues.optional(),
});

export const personCreate = personBase
  .extend({
    /** Create even if likely duplicates exist (V29). */
    ignoreDuplicates: z.boolean().optional(),
  })
  .refine((p) => (p.kind === "natural" ? !!p.lastName : !!p.companyName), {
    message: "Natürliche Personen brauchen einen Nachnamen, juristische einen Firmennamen",
    path: ["lastName"],
  });
export const personUpdate = personBase.omit({ kind: true }).partial();
export type PersonCreate = z.infer<typeof personCreate>;
export type PersonUpdate = z.infer<typeof personUpdate>;

export const personRole = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  role: personRoleKind,
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  share: z.string().nullable(),
  note: z.string().nullable(),
});
export type PersonRole = z.infer<typeof personRole>;

export const person = z.object({
  id: z.string().uuid(),
  kind: z.enum(["natural", "legal"]),
  displayName: z.string(),
  salutation: z.string().nullable(),
  title: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  companyName: z.string().nullable(),
  birthDate: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
  communicationPreference: z.string(),
  iban: z.string().nullable(),
  notes: z.string().nullable(),
  mergedIntoId: z.string().uuid().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  roles: z.array(personRole),
});
export type Person = z.infer<typeof person>;

export const personRoleCreate = z
  .object({
    role: personRoleKind,
    propertyId: z.string().uuid(),
    unitId: z.string().uuid().nullable().optional(),
    validFrom: isoDate.nullable().optional(),
    validTo: isoDate.nullable().optional(),
    share: z.string().regex(/^\d+\/\d+$/, "Anteil als Bruch, z. B. 1/2").nullable().optional(),
    note: optionalText(500),
  })
  .refine((r) => !r.validFrom || !r.validTo || r.validTo > r.validFrom, { message: "Ende muss nach Beginn liegen", path: ["validTo"] });
export type PersonRoleCreate = z.infer<typeof personRoleCreate>;

export const duplicateCandidate = z.object({
  personId: z.string().uuid(),
  displayName: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
});
export type DuplicateCandidate = z.infer<typeof duplicateCandidate>;

// ---------- Technical assets and meters ----------

export const assetAttributes = z
  .object({
    largeSystem: z.boolean().optional(),
    showersOrAerosol: z.boolean().optional(),
    commercialActivity: z.boolean().optional(),
    storageLitres: z.number().nonnegative().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const assetCreate = z.object({
  buildingId: z.string().uuid().nullable().optional(),
  kind: assetKind,
  name: text(200),
  installedOn: isoDate.nullable().optional(),
  energyCarrier: energyCarrier.nullable().optional(),
  lastInspectionOn: isoDate.nullable().optional(),
  attributes: assetAttributes.optional(),
});
export const assetUpdate = assetCreate.partial();
export type AssetCreate = z.infer<typeof assetCreate>;

export const asset = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  buildingId: z.string().uuid().nullable(),
  kind: assetKind,
  name: z.string(),
  installedOn: z.string().nullable(),
  energyCarrier: z.string().nullable(),
  lastInspectionOn: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
});
export type Asset = z.infer<typeof asset>;

export const meterCreate = z.object({
  unitId: z.string().uuid().nullable().optional(),
  buildingId: z.string().uuid().nullable().optional(),
  kind: meterKind,
  serialNumber: text(60),
  location: optionalText(200),
  remoteReadable: z.boolean().optional(),
  interoperable: z.boolean().optional(),
  calibrationValidUntil: isoDate.nullable().optional(),
  /** Alternative to calibrationValidUntil: year of calibration (RECHT-PRÜFEN R-019). */
  calibrationYear: z.number().int().min(1990).max(2100).nullable().optional(),
  installedOn: isoDate.nullable().optional(),
});
export const meterUpdate = meterCreate.partial();
export type MeterCreate = z.infer<typeof meterCreate>;

export const meter = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().nullable(),
  buildingId: z.string().uuid().nullable(),
  kind: meterKind,
  serialNumber: z.string(),
  location: z.string().nullable(),
  remoteReadable: z.boolean(),
  interoperable: z.boolean(),
  calibrationValidUntil: z.string().nullable(),
  installedOn: z.string().nullable(),
});
export type Meter = z.infer<typeof meter>;

// ---------- Custom field definitions (V18) ----------

export const customFieldDefinitionCreate = z
  .object({
    entityType: z.enum(["property", "building", "unit", "person"]),
    key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Schlüssel: Kleinbuchstaben, Ziffern, Unterstrich"),
    label: text(100),
    fieldType: z.enum(["text", "number", "date", "boolean", "select"]),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1)).optional(),
    position: z.number().int().optional(),
  })
  .refine((d) => d.fieldType !== "select" || (d.options?.length ?? 0) > 0, { message: "Auswahlfelder brauchen Optionen", path: ["options"] });
export type CustomFieldDefinitionCreate = z.infer<typeof customFieldDefinitionCreate>;

export const customFieldDefinition = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  key: z.string(),
  label: z.string(),
  fieldType: z.string(),
  required: z.boolean(),
  options: z.array(z.string()),
  position: z.number(),
});
export type CustomFieldDefinition = z.infer<typeof customFieldDefinition>;
