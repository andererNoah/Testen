import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { seedScenario, type Scenario } from "@hv/access/test-support";
import { buildTestApp } from "./helpers";

let t: TestDatabase;
let s: Scenario;
let app: FastifyInstance;
let adminAuth: Record<string, string>;
let renterAuth: Record<string, string>;

beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
  const built = await buildTestApp(t);
  app = built.app;
  adminAuth = { authorization: `Bearer ${await built.token(s.a.adminUserId, s.a.tenantId)}` };
  renterAuth = { authorization: `Bearer ${await built.token(s.a.renterUserId, s.a.tenantId)}` };
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

function form(fields: Record<string, string>, file?: { name: string; data: Buffer }) {
  const boundary = "----hvdoc" + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/pdf\r\n\r\n`), file.data, Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("Dokumente über die API", () => {
  it("hochladen, auflisten, herunterladen, Version ergänzen", async () => {
    const upload = form(
      { title: "Hausordnung", category: "other", links: JSON.stringify([{ entityType: "unit", entityId: s.a.u1 }]) },
      { name: "hausordnung.pdf", data: Buffer.from("%PDF-1.7\nHausordnung\n%%EOF") },
    );
    const created = await app.inject({ method: "POST", url: "/v1/documents", payload: upload.payload, headers: { ...adminAuth, ...upload.headers } });
    expect(created.statusCode).toBe(201);
    const doc = created.json();

    const listed = await app.inject({ method: "GET", url: `/v1/documents?entityType=unit&entityId=${s.a.u1}`, headers: renterAuth });
    expect(listed.json().items.map((d: { id: string }) => d.id)).toEqual([doc.id]);

    const content = await app.inject({ method: "GET", url: `/v1/documents/${doc.id}/content`, headers: renterAuth });
    expect(content.statusCode).toBe(200);
    expect(content.headers["content-type"]).toBe("application/pdf");
    expect(content.headers["content-disposition"]).toContain("hausordnung.pdf");
    expect(content.body).toContain("Hausordnung");

    const v2 = form({}, { name: "hausordnung-2026.pdf", data: Buffer.from("%PDF-1.7\nNeu\n%%EOF") });
    const versioned = await app.inject({ method: "POST", url: `/v1/documents/${doc.id}/versions`, payload: v2.payload, headers: { ...adminAuth, ...v2.headers } });
    expect(versioned.json().currentVersion).toBe(2);
    const old = await app.inject({ method: "GET", url: `/v1/documents/${doc.id}/content?version=1`, headers: adminAuth });
    expect(old.body).toContain("Hausordnung");
  });

  it("422 mit Feldhinweisen bei fehlenden Angaben", async () => {
    const upload = form({ title: "", category: "unbekannt", links: "[]" }, { name: "x.pdf", data: Buffer.from("%PDF-1.7") });
    const res = await app.inject({ method: "POST", url: "/v1/documents", payload: upload.payload, headers: { ...adminAuth, ...upload.headers } });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.map((i: { path: string }) => i.path).sort()).toEqual(["category", "links", "title"]);
  });

  it("Mieter darf nicht ablegen", async () => {
    const upload = form({ title: "X", category: "other", links: JSON.stringify([{ entityType: "unit", entityId: s.a.u1 }]) }, { name: "x.pdf", data: Buffer.from("%PDF-1.7") });
    const res = await app.inject({ method: "POST", url: "/v1/documents", payload: upload.payload, headers: { ...renterAuth, ...upload.headers } });
    expect(res.statusCode).toBe(403);
  });
});
