import { DomainError, ValidationError, fromPgError } from "@hv/core";
import { sql, type MeasureKind, type Row } from "@hv/db";
import { calibrationValidUntil } from "@hv/deadlines";
import * as md from "@hv/masterdata";
import type { EntityKey } from "./fields";
import { emptyCounts, type EntityCounts, type IssueCollector } from "./report";
import type { ImportRecord, RecordSet } from "./transform";
import type { ParsedValue } from "./values";

type Ctx = md.Ctx;

export interface ExecuteOptions {
  /** Origin of external keys (e.g. name of the legacy system). */
  source: string;
  /** Collect errors per row and continue (dry run) instead of aborting on the first error. */
  continueOnError: boolean;
}

const s = (v: ParsedValue | undefined): string | null => (v === null || v === undefined ? null : String(v));
const n = (v: ParsedValue | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const b = (v: ParsedValue | undefined): boolean | undefined => (v === null || v === undefined ? undefined : Boolean(v));
const key = (...parts: Array<string | null | undefined>) => parts.map((p) => (p ?? "").toLowerCase()).join("|");

/** Changed fields only: `undefined` where the import value equals the current value. */
function diff<T extends Record<string, unknown>>(current: Record<string, unknown>, next: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    if ((current[k] ?? null) !== (v ?? null)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function propertyInput(r: Row<"properties">) {
  return {
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
  };
}

function personInput(r: Row<"persons">) {
  return {
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
  };
}

class Lookup {
  properties = new Map<string, { id: string; kind: string }>();
  buildings = new Map<string, string>();
  units = new Map<string, string>();
  persons = new Map<string, string>();
}

/**
 * Applies the records in dependency order (V20). Idempotent: natural keys (Objektnummer,
 * Einheit, Zählernummer) and external person keys find existing rows, which are only updated
 * where values differ. Every record runs in a savepoint so a failing row is reported with its
 * row number.
 */
export async function executeImport(ctx: Ctx, records: RecordSet, issues: IssueCollector, options: ExecuteOptions): Promise<Record<EntityKey, EntityCounts>> {
  const counts = emptyCounts();
  const lookup = new Lookup();
  let sp = 0;

  async function step(entity: EntityKey, record: ImportRecord, fn: () => Promise<"created" | "updated" | "unchanged">, count = true) {
    const name = `rec_${++sp}`;
    await sql.raw(`SAVEPOINT ${name}`).execute(ctx.trx);
    try {
      const result = await fn();
      await sql.raw(`RELEASE SAVEPOINT ${name}`).execute(ctx.trx);
      if (count) counts[entity][result]++;
    } catch (error) {
      await sql.raw(`ROLLBACK TO SAVEPOINT ${name}`).execute(ctx.trx);
      counts[entity].failed++;
      const domain = error instanceof DomainError ? error : fromPgError(error);
      if (!domain) throw error;
      const detail = error instanceof md.DuplicatePersonError ? "" : (domain as { issues?: Array<{ path: string; message: string }> }).issues?.map((i) => `${i.path}: ${i.message}`).join("; ");
      issues.error({ sheet: record.sheet, row: record.row, message: detail ? `${domain.message} (${detail})` : domain.message });
      if (!options.continueOnError) throw error;
    }
  }

  // ---------- Properties ----------
  const existingProps = await ctx.trx.selectFrom("properties").selectAll().execute();
  for (const p of existingProps) lookup.properties.set(p.code.toLowerCase(), { id: p.id, kind: p.kind });
  for (const r of records.properties) {
    const v = r.values;
    await step("properties", r, async () => {
      const kind = String(v.kind) as "weg" | "rental" | "sev";
      const input = {
        code: String(v.code),
        name: String(v.name),
        street: s(v.street),
        houseNumber: s(v.houseNumber),
        postalCode: s(v.postalCode),
        city: s(v.city),
        state: s(v.state) as md.PropertyCreate["state"],
        meaDenominator: kind === "rental" ? null : n(v.meaDenominator),
        votingPrinciple: kind === "rental" ? null : (s(v.votingPrinciple) as md.PropertyCreate["votingPrinciple"]),
        settlementPeriodStartMonth: n(v.settlementPeriodStartMonth) ?? undefined,
      };
      const existing = existingProps.find((p) => p.code.toLowerCase() === input.code.toLowerCase());
      if (existing) {
        if (existing.kind !== kind) throw new ValidationError(`Objekt ${input.code} existiert bereits als ${existing.kind}; die Art kann nicht geändert werden.`);
        const changes = diff(propertyInput(existing), input);
        if (Object.keys(changes).length === 0) return "unchanged";
        await md.updateProperty(ctx, existing.id, changes);
        return "updated";
      }
      const created = await md.createProperty(ctx, { kind, ...input, votingPrinciple: input.votingPrinciple ?? undefined });
      lookup.properties.set(created.code.toLowerCase(), { id: created.id, kind: created.kind });
      return "created";
    });
  }

  const propertyId = (code: ParsedValue | undefined): string => {
    const hit = lookup.properties.get(String(code ?? "").toLowerCase());
    if (!hit) throw new ValidationError(`Objekt „${code}“ gibt es weder in der Datei noch im System.`);
    return hit.id;
  };

  // ---------- Buildings ----------
  const existingBuildings = await ctx.trx.selectFrom("buildings").selectAll().execute();
  for (const bld of existingBuildings) lookup.buildings.set(key(bld.property_id, bld.name), bld.id);
  for (const r of records.buildings) {
    const v = r.values;
    await step("buildings", r, async () => {
      const pid = propertyId(v.propertyCode);
      const input = {
        name: String(v.name),
        street: s(v.street),
        houseNumber: s(v.houseNumber),
        postalCode: s(v.postalCode),
        city: s(v.city),
        yearBuilt: n(v.yearBuilt),
        usage: (s(v.usage) ?? undefined) as md.BuildingCreate["usage"],
      };
      const existingId = lookup.buildings.get(key(pid, input.name));
      if (existingId) {
        const current = existingBuildings.find((x) => x.id === existingId)!;
        const changes = diff(
          { name: current.name, street: current.street, houseNumber: current.house_number, postalCode: current.postal_code, city: current.city, yearBuilt: current.year_built, usage: current.usage },
          input,
        );
        if (Object.keys(changes).length === 0) return "unchanged";
        await md.updateBuilding(ctx, existingId, changes);
        return "updated";
      }
      const created = await md.createBuilding(ctx, pid, input);
      lookup.buildings.set(key(pid, created.name), created.id);
      return "created";
    });
  }

  const buildingId = (pid: string, name: ParsedValue | undefined): string | null => {
    if (!name) return null;
    const id = lookup.buildings.get(key(pid, String(name)));
    if (!id) throw new ValidationError(`Gebäude „${name}“ gibt es in diesem Objekt nicht.`);
    return id;
  };

  // ---------- Units (+ measures) ----------
  const existingUnits = await ctx.trx.selectFrom("units").selectAll().execute();
  for (const u of existingUnits) lookup.units.set(key(u.property_id, u.number), u.id);
  const defaultValidFrom = `${ctx.today.slice(0, 4)}-01-01`;
  const measureFields: Array<[string, MeasureKind]> = [
    ["livingArea", "living_area"],
    ["usableArea", "usable_area"],
    ["heatedArea", "heated_area"],
    ["mea", "mea"],
    ["persons", "persons"],
  ];
  const links: Array<{ record: ImportRecord; unitId: string }> = [];
  for (const r of records.units) {
    const v = r.values;
    await step("units", r, async () => {
      const pid = propertyId(v.propertyCode);
      const input = {
        number: String(v.number),
        type: String(v.type) as md.UnitCreate["type"],
        buildingId: buildingId(pid, v.buildingName),
        floor: s(v.floor),
        position: s(v.position),
      };
      let unitId = lookup.units.get(key(pid, input.number));
      let result: "created" | "updated" | "unchanged" = "unchanged";
      if (unitId) {
        const current = existingUnits.find((x) => x.id === unitId)!;
        const changes = diff({ number: current.number, type: current.type, buildingId: current.building_id, floor: current.floor, position: current.position }, input);
        if (Object.keys(changes).length) {
          await md.updateUnit(ctx, unitId, changes);
          result = "updated";
        }
      } else {
        unitId = (await md.createUnit(ctx, pid, input)).id;
        lookup.units.set(key(pid, input.number), unitId);
        result = "created";
      }
      const validFrom = s(v.validFrom) ?? defaultValidFrom;
      const currentMeasures = (await md.measuresAsOf(ctx.trx, [unitId], validFrom)).get(unitId) ?? {};
      for (const [field, measure] of measureFields) {
        const value = s(v[field]);
        if (value === null) continue;
        const current = currentMeasures[measure];
        if (current !== undefined && Number(current) === Number(value)) continue;
        await md.setUnitMeasure(ctx, unitId, { measure, value, validFrom });
        if (result === "unchanged") result = "updated";
      }
      if (v.linkedPropertyCode && v.linkedUnitNumber) links.push({ record: r, unitId });
      return result;
    });
  }
  // SEV units point to WEG units that may come later in the file: second pass.
  for (const { record, unitId } of links) {
    await step("units", record, async () => {
      const linkedPid = propertyId(record.values.linkedPropertyCode);
      const linkedId = lookup.units.get(key(linkedPid, String(record.values.linkedUnitNumber)));
      if (!linkedId) throw new ValidationError(`WEG-Einheit „${record.values.linkedUnitNumber}“ in Objekt „${record.values.linkedPropertyCode}“ nicht gefunden.`);
      const current = await ctx.trx.selectFrom("units").select("linked_unit_id").where("id", "=", unitId).executeTakeFirstOrThrow();
      if (current.linked_unit_id === linkedId) return "unchanged";
      await md.updateUnit(ctx, unitId, { linkedUnitId: linkedId });
      return "updated";
    }, false);
  }

  const unitId = (pid: string, number: ParsedValue | undefined): string | null => {
    if (!number) return null;
    const id = lookup.units.get(key(pid, String(number)));
    if (!id) throw new ValidationError(`Einheit „${number}“ gibt es in diesem Objekt nicht.`);
    return id;
  };

  // ---------- Persons ----------
  const keyRows = await ctx.trx.selectFrom("external_keys").select(["external_key", "entity_id"]).where("source", "=", options.source).where("entity_type", "=", "person").execute();
  for (const k of keyRows) lookup.persons.set(k.external_key.toLowerCase(), k.entity_id);
  for (const r of records.persons) {
    const v = r.values;
    await step("persons", r, async () => {
      const input = {
        salutation: s(v.salutation),
        title: s(v.title),
        firstName: s(v.firstName),
        lastName: s(v.lastName),
        companyName: s(v.companyName),
        birthDate: s(v.birthDate),
        email: s(v.email),
        phone: s(v.phone),
        mobile: s(v.mobile),
        street: s(v.street),
        houseNumber: s(v.houseNumber),
        postalCode: s(v.postalCode),
        city: s(v.city),
        country: s(v.country) ?? undefined,
        communicationPreference: (s(v.communicationPreference) ?? undefined) as md.PersonCreate["communicationPreference"],
        iban: s(v.iban),
      };
      const externalKey = String(v.externalKey);
      const existingId = lookup.persons.get(externalKey.toLowerCase());
      if (existingId) {
        const current = await ctx.trx.selectFrom("persons").selectAll().where("id", "=", existingId).executeTakeFirst();
        if (!current) throw new ValidationError(`Person „${externalKey}“ aus einem früheren Import ist nicht mehr sichtbar.`);
        const changes = diff(personInput(current), input);
        if (Object.keys(changes).length === 0) return "unchanged";
        await md.updatePerson(ctx, existingId, changes);
        return "updated";
      }
      const kind = (v.kind ?? "natural") as "natural" | "legal";
      const candidates = await md.findDuplicateCandidates(ctx.trx, { kind, ...input });
      if (candidates.length) {
        issues.warning({
          sheet: r.sheet,
          row: r.row,
          message: `Mögliche Dublette: ${candidates.map((c) => `${c.displayName} (${c.reasons.join(", ")})`).join("; ")}`,
        });
      }
      const created = await md.createPerson(ctx, { kind, ...input, ignoreDuplicates: true });
      await ctx.trx
        .insertInto("external_keys")
        .values({ tenant_id: ctx.principal.tenantId, source: options.source, entity_type: "person", external_key: externalKey, entity_id: created.id })
        .execute();
      lookup.persons.set(externalKey.toLowerCase(), created.id);
      return "created";
    });
  }

  // ---------- Roles ----------
  for (const r of records.roles) {
    const v = r.values;
    await step("roles", r, async () => {
      const personId = lookup.persons.get(String(v.personKey).toLowerCase());
      if (!personId) throw new ValidationError(`Person „${v.personKey}“ gibt es weder in der Datei noch aus früheren Importen.`);
      const pid = propertyId(v.propertyCode);
      const uid = unitId(pid, v.unitNumber);
      const role = String(v.role) as md.PersonRoleCreate["role"];
      let q = ctx.trx.selectFrom("person_roles").select(["id", "valid_to", "share"]).where("person_id", "=", personId).where("role", "=", role).where("property_id", "=", pid);
      q = uid ? q.where("unit_id", "=", uid) : q.where("unit_id", "is", null);
      q = v.validFrom ? q.where("valid_from", "=", String(v.validFrom)) : q.where("valid_from", "is", null);
      const existing = await q.executeTakeFirst();
      if (existing) {
        const validTo = s(v.validTo);
        if (validTo && existing.valid_to !== validTo) {
          await md.endPersonRole(ctx, existing.id, validTo);
          return "updated";
        }
        return "unchanged";
      }
      await md.addPersonRole(ctx, personId, { role, propertyId: pid, unitId: uid, validFrom: s(v.validFrom), validTo: s(v.validTo), share: s(v.share) });
      return "created";
    });
  }

  // ---------- Technical assets ----------
  const existingAssets = await ctx.trx.selectFrom("technical_assets").selectAll().execute();
  for (const r of records.assets) {
    const v = r.values;
    await step("assets", r, async () => {
      const pid = propertyId(v.propertyCode);
      const input: md.AssetCreate = {
        kind: String(v.kind) as md.AssetCreate["kind"],
        name: String(v.name),
        buildingId: buildingId(pid, v.buildingName),
        installedOn: s(v.installedOn),
        energyCarrier: s(v.energyCarrier) as md.AssetCreate["energyCarrier"],
        lastInspectionOn: s(v.lastInspectionOn),
        ...(v.largeSystem !== null && v.largeSystem !== undefined ? { attributes: { largeSystem: Boolean(v.largeSystem) } } : {}),
      };
      const existing = existingAssets.find((a) => a.property_id === pid && a.kind === input.kind && a.name.toLowerCase() === input.name.toLowerCase());
      if (existing) {
        const changes = diff(
          { buildingId: existing.building_id, installedOn: existing.installed_on, energyCarrier: existing.energy_carrier, lastInspectionOn: existing.last_inspection_on },
          { buildingId: input.buildingId, installedOn: input.installedOn, energyCarrier: input.energyCarrier, lastInspectionOn: input.lastInspectionOn },
        );
        const attrsChanged = input.attributes && (existing.attributes as Record<string, unknown>).largeSystem !== input.attributes.largeSystem;
        if (Object.keys(changes).length === 0 && !attrsChanged) return "unchanged";
        await md.updateAsset(ctx, existing.id, { ...changes, ...(attrsChanged ? { attributes: input.attributes } : {}) });
        return "updated";
      }
      await md.createAsset(ctx, pid, input);
      return "created";
    });
  }

  // ---------- Meters ----------
  const existingMeters = await ctx.trx.selectFrom("meters").selectAll().execute();
  for (const r of records.meters) {
    const v = r.values;
    await step("meters", r, async () => {
      const pid = propertyId(v.propertyCode);
      const input: md.MeterCreate = {
        kind: String(v.kind) as md.MeterCreate["kind"],
        serialNumber: String(v.serialNumber),
        unitId: unitId(pid, v.unitNumber),
        location: s(v.location),
        remoteReadable: b(v.remoteReadable),
        interoperable: b(v.interoperable),
        calibrationValidUntil: s(v.calibrationValidUntil),
        calibrationYear: n(v.calibrationYear),
      };
      const existing = existingMeters.find((m) => m.kind === input.kind && m.serial_number.toLowerCase() === input.serialNumber.toLowerCase());
      if (existing) {
        if (existing.property_id !== pid) throw new ValidationError(`Zähler ${input.serialNumber} ist bereits einem anderen Objekt zugeordnet.`);
        const before = { unitId: existing.unit_id, location: existing.location, remoteReadable: existing.remote_readable, interoperable: existing.interoperable };
        const changes = diff(before, { unitId: input.unitId, location: input.location, remoteReadable: input.remoteReadable, interoperable: input.interoperable });
        const calibration = input.calibrationValidUntil ?? (input.calibrationYear ? calibrationValidUntil(input.kind, input.calibrationYear, ctx.today) : null);
        const calibrationChanged = calibration !== null && calibration !== existing.calibration_valid_until;
        if (Object.keys(changes).length === 0 && !calibrationChanged) return "unchanged";
        await md.updateMeter(ctx, existing.id, { ...changes, ...(calibrationChanged ? { calibrationValidUntil: calibration } : {}) });
        return "updated";
      }
      await md.createMeter(ctx, pid, input);
      return "created";
    });
  }

  return counts;
}
