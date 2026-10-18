import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { DEMO_DIR, seedDemoTenant } from "../src/demo-seed";
import { buildTestApp, client } from "./helpers";

let t: TestDatabase;
let app: FastifyInstance;
let token: (userId: string, tenantId: string) => Promise<string>;
let tenantId: string;

beforeAll(async () => {
  t = await createTestDatabase();
  ({ app, token } = await buildTestApp(t));
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

function multipart(files: Array<{ name: string; data: Buffer }>, fields: Record<string, string> = {}) {
  const boundary = "----hvtest" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    chunks.push(f.data, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("Demo-Mandant per Seed", () => {
  it("legt Mandant, Daten und Benutzer an und ist wiederholbar", async () => {
    const result = await seedDemoTenant(t.ownerDb, t.appDb, "2026-10-18");
    expect(result.created).toBe(true);
    expect(result.logins.length).toBe(8);
    tenantId = result.tenantId;
    expect((await seedDemoTenant(t.ownerDb, t.appDb, "2026-10-18")).created).toBe(false);
  });

  it("Rollen greifen im Demo-Mandanten: Mieter sieht nur seine Wohnung", async () => {
    const paul = await t.ownerDb.selectFrom("users").select("id").where("email", "=", "paul.richter@example.org").executeTakeFirstOrThrow();
    const api = client(app, await token(paul.id, tenantId));
    const props = (await api.get("/v1/properties")).json().items;
    expect(props.map((p: { code: string }) => p.code)).toEqual(["M001"]);
    const units = (await api.get(`/v1/properties/${props[0].id}/units`)).json().items;
    expect(units.map((u: { number: string }) => u.number)).toEqual(["WE 01"]);
  });

  it("Objektbetreuer sieht genau seine zwei Objekte", async () => {
    const olaf = await t.ownerDb.selectFrom("users").select("id").where("email", "=", "objektbetreuer@muster-hv.example").executeTakeFirstOrThrow();
    const api = client(app, await token(olaf.id, tenantId));
    const codes = (await api.get("/v1/properties")).json().items.map((p: { code: string }) => p.code);
    expect(codes).toEqual(["S001", "W001"]);
  });
});

describe("Import über die API (multipart)", () => {
  it("Upload → Prüfung → Übernahme; Vorlage herunterladen", async () => {
    const admin = await t.ownerDb.selectFrom("users").select("id").where("email", "=", "admin@muster-hv.example").executeTakeFirstOrThrow();
    const auth = { authorization: `Bearer ${await token(admin.id, tenantId)}` };
    const csv = "Objektnummer;Art;Name;PLZ;Ort;Bundesland\nN001;Miete;Neubau Südvorstadt;04275;Leipzig;Sachsen\n";
    const body = multipart([{ name: "objekte.csv", data: Buffer.from(csv) }], { source: "Altsystem X" });
    const created = await app.inject({ method: "POST", url: "/v1/imports", payload: body.payload, headers: { ...auth, ...body.headers } });
    expect(created.statusCode).toBe(201);
    const job = created.json();
    expect(job.source).toBe("altsystem-x");
    expect(job.sheets[0].entity).toBe("properties");

    const validated = await app.inject({ method: "POST", url: `/v1/imports/${job.id}/validate`, headers: auth });
    expect(validated.json().report).toMatchObject({ ok: true, errors: 0 });
    const committed = await app.inject({ method: "POST", url: `/v1/imports/${job.id}/commit`, headers: auth });
    expect(committed.json().status).toBe("committed");
    expect(committed.json().summary.counts.properties.created).toBe(1);

    const again = await app.inject({ method: "POST", url: `/v1/imports/${job.id}/commit`, headers: auth });
    expect(again.statusCode).toBe(409);

    const template = await app.inject({ method: "GET", url: "/v1/imports/template.xlsx", headers: auth });
    expect(template.statusCode).toBe(200);
    expect(template.headers["content-type"]).toContain("spreadsheetml");
    expect(template.rawPayload.subarray(0, 2).toString()).toBe("PK");

    const fields = (await app.inject({ method: "GET", url: "/v1/imports/fields", headers: auth })).json().items;
    expect(fields.map((f: { key: string }) => f.key)).toEqual(["properties", "buildings", "units", "persons", "roles", "assets", "meters"]);
  });

  it("XLSX des Demo-Mandanten lässt sich prüfen", async () => {
    const admin = await t.ownerDb.selectFrom("users").select("id").where("email", "=", "admin@muster-hv.example").executeTakeFirstOrThrow();
    const auth = { authorization: `Bearer ${await token(admin.id, tenantId)}` };
    const body = multipart([{ name: "demo-mandant.xlsx", data: await readFile(path.join(DEMO_DIR, "demo-mandant.xlsx")) }], { source: "demo" });
    const job = (await app.inject({ method: "POST", url: "/v1/imports", payload: body.payload, headers: { ...auth, ...body.headers } })).json();
    const report = (await app.inject({ method: "POST", url: `/v1/imports/${job.id}/validate`, headers: auth })).json().report;
    expect(report.errors).toBe(0);
    expect(Object.values(report.counts as Record<string, { created: number }>).every((c) => c.created === 0)).toBe(true);
  });

  it("ohne Datei: verständlicher Fehler", async () => {
    const admin = await t.ownerDb.selectFrom("users").select("id").where("email", "=", "admin@muster-hv.example").executeTakeFirstOrThrow();
    const res = await client(app, await token(admin.id, tenantId)).post("/v1/imports", {});
    expect(res.statusCode).toBe(422);
  });
});
