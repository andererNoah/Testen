import type { Row } from "@hv/db";
import type { Asset, Building, Meter, Person, PersonRole, Property } from "./schemas";

const iso = (d: Date | string | null): string | null => (d === null ? null : d instanceof Date ? d.toISOString() : d);

export function toProperty(r: Row<"properties">): Property {
  return {
    id: r.id,
    kind: r.kind,
    code: r.code,
    name: r.name,
    street: r.street,
    houseNumber: r.house_number,
    postalCode: r.postal_code,
    city: r.city,
    state: r.state,
    meaDenominator: r.mea_denominator,
    votingPrinciple: r.voting_principle,
    settlementPeriodStartMonth: r.settlement_period_start_month,
    customFields: r.custom_fields,
    archivedAt: iso(r.archived_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toBuilding(r: Row<"buildings">): Building {
  return {
    id: r.id,
    propertyId: r.property_id,
    name: r.name,
    street: r.street,
    houseNumber: r.house_number,
    postalCode: r.postal_code,
    city: r.city,
    yearBuilt: r.year_built,
    usage: r.usage,
    customFields: r.custom_fields,
  };
}

export function toPersonRole(r: Row<"person_roles">): PersonRole {
  return {
    id: r.id,
    personId: r.person_id,
    role: r.role,
    propertyId: r.property_id,
    unitId: r.unit_id,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    share: r.share,
    note: r.note,
  };
}

export function personDisplayName(r: Pick<Row<"persons">, "kind" | "first_name" | "last_name" | "company_name" | "title">): string {
  if (r.kind === "legal") return r.company_name ?? "";
  return [r.title, r.first_name, r.last_name].filter(Boolean).join(" ");
}

export function toPerson(r: Row<"persons">, roles: Row<"person_roles">[] = []): Person {
  return {
    id: r.id,
    kind: r.kind,
    displayName: personDisplayName(r),
    salutation: r.salutation,
    title: r.title,
    firstName: r.first_name,
    lastName: r.last_name,
    companyName: r.company_name,
    birthDate: r.birth_date,
    email: r.email,
    phone: r.phone,
    mobile: r.mobile,
    street: r.street,
    houseNumber: r.house_number,
    postalCode: r.postal_code,
    city: r.city,
    country: r.country,
    communicationPreference: r.communication_preference,
    iban: r.iban,
    notes: r.notes,
    mergedIntoId: r.merged_into_id,
    customFields: r.custom_fields,
    roles: roles.map(toPersonRole),
  };
}

export function toAsset(r: Row<"technical_assets">): Asset {
  return {
    id: r.id,
    propertyId: r.property_id,
    buildingId: r.building_id,
    kind: r.kind,
    name: r.name,
    installedOn: r.installed_on,
    energyCarrier: r.energy_carrier,
    lastInspectionOn: r.last_inspection_on,
    attributes: r.attributes,
  };
}

export function toMeter(r: Row<"meters">): Meter {
  return {
    id: r.id,
    propertyId: r.property_id,
    unitId: r.unit_id,
    buildingId: r.building_id,
    kind: r.kind,
    serialNumber: r.serial_number,
    location: r.location,
    remoteReadable: r.remote_readable,
    interoperable: r.interoperable,
    calibrationValidUntil: r.calibration_valid_until,
    installedOn: r.installed_on,
  };
}

/** Drops keys whose value is `undefined` (PATCH semantics: absent = unchanged). */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
