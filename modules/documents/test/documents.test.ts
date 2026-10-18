import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@hv/access";
import { ConflictError, ValidationError } from "@hv/core";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { seedScenario, type Scenario } from "@hv/access/test-support";
import { loadPrincipal } from "@hv/access";
import { withTenant } from "@hv/db";
import type { Ctx } from "@hv/masterdata";
import {
  MemoryStorage,
  addDocumentVersion,
  deleteDocument,
  getDocument,
  linkDocument,
  listDocuments,
  readDocumentContent,
  retentionFor,
  unlinkDocument,
  uploadDocument,
} from "@hv/documents";

let t: TestDatabase;
let s: Scenario;
const storage = new MemoryStorage();
const pdf = (text: string) => Buffer.from(`%PDF-1.7\n${text}\n%%EOF`);

beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
});
afterAll(async () => {
  await t.destroy();
});

const as = <T>(userId: string, fn: (ctx: Ctx) => Promise<T>, today = "2026-10-18") =>
  withTenant(t.appDb, { tenantId: s.a.tenantId, userId }, async (trx) => fn({ trx, principal: await loadPrincipal(trx, userId), today }));

describe("Dokumentenablage", () => {
  it("legt ein Dokument mit Version, Prüfsumme und Akten an", async () => {
    const doc = await as(s.a.managerUserId, (ctx) =>
      uploadDocument(ctx, storage, { title: "Übergabeprotokoll WE 01", category: "protocol", links: [{ entityType: "unit", entityId: s.a.u1 }, { entityType: "person", entityId: s.a.renterPersonId }] }, { filename: "protokoll.pdf", data: pdf("v1") }),
    );
    expect(doc.currentVersion).toBe(1);
    expect(doc.links.map((l) => l.entityType).sort()).toEqual(["person", "unit"]);
    expect(doc.links.every((l) => l.entityType === "person" || l.propertyId === s.a.p1)).toBe(true);
    expect(doc.versions[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("neue Versionen behalten die alten; Inhalt wird mit Prüfsumme gelesen", async () => {
    const [doc] = await as(s.a.managerUserId, (ctx) => listDocuments(ctx, { entityType: "unit", entityId: s.a.u1 }));
    const updated = await as(s.a.managerUserId, (ctx) => addDocumentVersion(ctx, storage, doc!.id, { filename: "protokoll-korrigiert.pdf", data: pdf("v2") }));
    expect(updated.versions.map((v) => v.version)).toEqual([2, 1]);
    const v1 = await as(s.a.managerUserId, (ctx) => readDocumentContent(ctx, storage, doc!.id, 1));
    expect(v1.data.toString()).toContain("v1");
    const current = await as(s.a.managerUserId, (ctx) => readDocumentContent(ctx, storage, doc!.id));
    expect(current.filename).toBe("protokoll-korrigiert.pdf");
  });

  it("erkennt manipulierte Inhalte", async () => {
    const [doc] = await as(s.a.managerUserId, (ctx) => listDocuments(ctx, { entityType: "unit", entityId: s.a.u1 }));
    const key = [...storage.files.keys()].find((k) => k.includes(doc!.id) && k.includes("/v1-"))!;
    storage.files.set(key, pdf("manipuliert"));
    await expect(as(s.a.managerUserId, (ctx) => readDocumentContent(ctx, storage, doc!.id, 1))).rejects.toThrow(/Prüfsumme/);
  });

  it("Mieter sieht Dokumente seiner Einheit, andere nicht", async () => {
    await as(s.a.adminUserId, (ctx) =>
      uploadDocument(ctx, storage, { title: "Wartungsvertrag Aufzug", category: "contract", links: [{ entityType: "property", entityId: s.a.p2 }] }, { filename: "vertrag.pdf", data: pdf("x") }),
    );
    const renterDocs = await as(s.a.renterUserId, (ctx) => listDocuments(ctx));
    expect(renterDocs.map((d) => d.title)).toEqual(["Übergabeprotokoll WE 01"]);
    const managerDocs = await as(s.a.managerUserId, (ctx) => listDocuments(ctx));
    expect(managerDocs.map((d) => d.title)).not.toContain("Wartungsvertrag Aufzug");
  });

  it("Objektbetreuer darf nicht in fremde Akten ablegen", async () => {
    await expect(
      as(s.a.managerUserId, (ctx) => uploadDocument(ctx, storage, { title: "X", category: "other", links: [{ entityType: "property", entityId: s.a.p2 }] }, { filename: "x.pdf", data: pdf("x") })),
    ).rejects.toThrow();
  });

  it("prüft Dateityp und Inhalt", async () => {
    const upload = (filename: string, data: Buffer) =>
      as(s.a.adminUserId, (ctx) => uploadDocument(ctx, storage, { title: "T", category: "other", links: [{ entityType: "property", entityId: s.a.p1 }] }, { filename, data }));
    await expect(upload("virus.exe", Buffer.from("MZ"))).rejects.toThrow(ValidationError);
    await expect(upload("falsch.pdf", Buffer.from("kein pdf"))).rejects.toThrow(/passt nicht/);
    await expect(upload("../../etc/passwd.txt", Buffer.from("x"))).resolves.toMatchObject({ versions: [expect.objectContaining({ filename: ".._.._etc_passwd.txt" })] });
  });

  it("ein Dokument liegt in mindestens einer Akte; weitere Akten lassen sich verknüpfen", async () => {
    const doc = await as(s.a.adminUserId, (ctx) =>
      uploadDocument(ctx, storage, { title: "Energieausweis", category: "certificate", links: [{ entityType: "property", entityId: s.a.p1 }] }, { filename: "ea.pdf", data: pdf("ea") }),
    );
    await expect(as(s.a.adminUserId, (ctx) => unlinkDocument(ctx, doc.id, doc.links[0]!.id))).rejects.toThrow(ValidationError);
    const linked = await as(s.a.adminUserId, (ctx) => linkDocument(ctx, doc.id, { entityType: "property", entityId: s.a.p2 }));
    expect(linked.links).toHaveLength(2);
  });

  it("Aufbewahrungsfristen aus dem Regelkatalog (GoBD, § 147 AO)", () => {
    expect(retentionFor("invoice", "2026-03-15")).toEqual({ until: "2034-12-31", rule: "ao.147.aufbewahrung@beg-iv" });
    expect(retentionFor("invoice", "2024-03-15")).toEqual({ until: "2034-12-31", rule: "ao.147.aufbewahrung@vor-beg-iv" });
    expect(retentionFor("statement", "2026-01-10")?.until).toBe("2036-12-31");
    expect(retentionFor("photo", "2026-01-10")).toBeNull();
  });

  it("löschen ist während der Aufbewahrungsfrist gesperrt", async () => {
    const invoice = await as(s.a.adminUserId, (ctx) =>
      uploadDocument(ctx, storage, { title: "Rechnung Dachrinne", category: "invoice", documentDate: "2026-05-02", links: [{ entityType: "property", entityId: s.a.p1 }] }, { filename: "r.pdf", data: pdf("r") }),
    );
    expect(invoice.retentionUntil).toBe("2034-12-31");
    await expect(as(s.a.adminUserId, (ctx) => deleteDocument(ctx, invoice.id))).rejects.toThrow(ConflictError);
    const photo = await as(s.a.adminUserId, (ctx) =>
      uploadDocument(ctx, storage, { title: "Foto Treppenhaus", category: "photo", links: [{ entityType: "property", entityId: s.a.p1 }] }, { filename: "f.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]) }),
    );
    const deleted = await as(s.a.adminUserId, (ctx) => deleteDocument(ctx, photo.id));
    expect(deleted.deletedAt).not.toBeNull();
    expect((await as(s.a.adminUserId, (ctx) => getDocument(ctx, photo.id))).deletedAt).not.toBeNull();
  });

  it("Personenakten nur mit Mandantenbereich", async () => {
    await expect(
      as(s.a.managerUserId, (ctx) => uploadDocument(ctx, storage, { title: "Ausweis", category: "other", links: [{ entityType: "person", entityId: s.a.renterPersonId }] }, { filename: "a.pdf", data: pdf("a") })),
    ).rejects.toThrow(ForbiddenError);
  });
});
