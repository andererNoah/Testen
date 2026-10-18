import { createHash } from "node:crypto";
import { ForbiddenError, hasTenantScope, requirePermission } from "@hv/access";
import { ConflictError, NotFoundError, ValidationError } from "@hv/core";
import type { DocumentCategory, Row } from "@hv/db";
import type { Ctx } from "@hv/masterdata";
import { rules } from "@hv/rules";
import { checkFile } from "./files";
import type { DocumentLinkInput, DocumentMeta, DocumentView } from "./schemas";
import { storageKey, type DocumentStorage } from "./storage";

const TABLE_BY_ENTITY = {
  property: "properties",
  building: "buildings",
  unit: "units",
  technical_asset: "technical_assets",
  meter: "meters",
} as const;

/** Resolves the property (Akte) of a link target; checks that the target is visible. */
async function resolveLink(ctx: Ctx, link: DocumentLinkInput): Promise<{ propertyId: string | null; unitId: string | null }> {
  if (link.entityType === "person") {
    const person = await ctx.trx.selectFrom("persons").select("id").where("id", "=", link.entityId).executeTakeFirst();
    if (!person) throw new NotFoundError("Person", link.entityId);
    return { propertyId: null, unitId: null };
  }
  if (link.entityType === "property") {
    const p = await ctx.trx.selectFrom("properties").select("id").where("id", "=", link.entityId).executeTakeFirst();
    if (!p) throw new NotFoundError("Objekt", link.entityId);
    return { propertyId: p.id, unitId: null };
  }
  const table = TABLE_BY_ENTITY[link.entityType];
  const row = await ctx.trx.selectFrom(table).select(["property_id"]).where("id", "=", link.entityId).executeTakeFirst();
  if (!row) throw new NotFoundError("Akte", link.entityId);
  return { propertyId: row.property_id, unitId: link.entityType === "unit" ? link.entityId : null };
}

/**
 * Retention per GoBD / § 147 AO from the rule catalog: the period starts at the end of the
 * calendar year of the document (RECHT-PRÜFEN R-014). Categories without a statutory period
 * get no date (manual decision).
 */
export function retentionFor(category: DocumentCategory, documentDate: string): { until: string; rule: string } | null {
  const rule = rules.resolve("ao.147.aufbewahrung", documentDate);
  const years: Partial<Record<DocumentCategory, number>> = {
    invoice: rule.params.bookingVouchersYears,
    statement: rule.params.booksYears,
    correspondence: rule.params.businessLettersYears,
    contract: rule.params.businessLettersYears,
  };
  const n = years[category];
  if (!n) return null;
  const year = Number(documentDate.slice(0, 4)) + n;
  return { until: `${year}-12-31`, rule: `${rule.key}@${rule.version}` };
}

async function toView(ctx: Ctx, doc: Row<"documents">): Promise<DocumentView> {
  const [links, versions] = await Promise.all([
    ctx.trx.selectFrom("document_links").selectAll().where("document_id", "=", doc.id).orderBy("created_at").execute(),
    ctx.trx.selectFrom("document_versions").selectAll().where("document_id", "=", doc.id).orderBy("version", "desc").execute(),
  ]);
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    documentDate: doc.document_date,
    currentVersion: doc.current_version,
    retentionUntil: doc.retention_until,
    retentionRule: doc.retention_rule,
    createdAt: doc.created_at.toISOString(),
    deletedAt: doc.deleted_at ? new Date(doc.deleted_at).toISOString() : null,
    links: links.map((l) => ({ id: l.id, entityType: l.entity_type, entityId: l.entity_id, propertyId: l.property_id })),
    versions: versions.map((v) => ({
      version: v.version,
      filename: v.filename,
      mimeType: v.mime_type,
      sizeBytes: v.size_bytes,
      sha256: v.sha256,
      createdAt: v.created_at.toISOString(),
      createdBy: v.created_by,
    })),
  };
}

/** Property files need the right on that property; person-only files need tenant-wide scope. */
function requireWriteFor(ctx: Ctx, target: { propertyId: string | null }) {
  if (target.propertyId) requirePermission(ctx.principal, "documents.write", { propertyId: target.propertyId });
  else if (!hasTenantScope(ctx.principal, "documents.write")) throw new ForbiddenError("documents.write");
}

async function storeVersion(ctx: Ctx, storage: DocumentStorage, documentId: string, version: number, file: { filename: string; data: Buffer }) {
  const checked = checkFile(file.filename, file.data);
  const sha256 = createHash("sha256").update(file.data).digest("hex");
  const key = storageKey(ctx.principal.tenantId, documentId, version, sha256);
  await storage.put(key, file.data);
  await ctx.trx
    .insertInto("document_versions")
    .values({
      tenant_id: ctx.principal.tenantId,
      document_id: documentId,
      version,
      storage_key: key,
      filename: checked.filename,
      mime_type: checked.mimeType,
      size_bytes: file.data.length,
      sha256,
      created_by: ctx.principal.userId,
    })
    .execute();
}

export async function uploadDocument(ctx: Ctx, storage: DocumentStorage, meta: DocumentMeta, file: { filename: string; data: Buffer }): Promise<DocumentView> {
  const resolved = await Promise.all(meta.links.map(async (l) => ({ ...l, ...(await resolveLink(ctx, l)) })));
  // A person file next to a property file is filed "in the context" of that property, so the
  // same people can see it; documents for a person alone need tenant-wide scope.
  const contextPropertyId = resolved.find((r) => r.propertyId)?.propertyId ?? null;
  for (const r of resolved) r.propertyId ??= contextPropertyId;
  if (!contextPropertyId) requireWriteFor(ctx, { propertyId: null });
  for (const r of resolved.filter((x) => x.propertyId)) requireWriteFor(ctx, r);
  checkFile(file.filename, file.data);
  const date = meta.documentDate ?? ctx.today;
  const retention = retentionFor(meta.category, date);
  const doc = await ctx.trx
    .insertInto("documents")
    .values({
      tenant_id: ctx.principal.tenantId,
      title: meta.title,
      category: meta.category,
      document_date: meta.documentDate ?? null,
      current_version: 1,
      retention_until: retention?.until ?? null,
      retention_rule: retention?.rule ?? null,
      created_by: ctx.principal.userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await storeVersion(ctx, storage, doc.id, 1, file);
  await ctx.trx
    .insertInto("document_links")
    .values(resolved.map((r) => ({ tenant_id: ctx.principal.tenantId, document_id: doc.id, entity_type: r.entityType, entity_id: r.entityId, property_id: r.propertyId })))
    .execute();
  return toView(ctx, doc);
}

async function loadDoc(ctx: Ctx, id: string): Promise<Row<"documents">> {
  const doc = await ctx.trx.selectFrom("documents").selectAll().where("id", "=", id).executeTakeFirst();
  if (!doc) throw new NotFoundError("Dokument", id);
  return doc;
}

async function writableProperty(ctx: Ctx, documentId: string): Promise<{ propertyId: string | null }> {
  const links = await ctx.trx.selectFrom("document_links").select("property_id").where("document_id", "=", documentId).execute();
  return { propertyId: links.find((l) => l.property_id)?.property_id ?? null };
}

export async function getDocument(ctx: Ctx, id: string): Promise<DocumentView> {
  requirePermission(ctx.principal, "documents.read");
  return toView(ctx, await loadDoc(ctx, id));
}

export interface DocumentFilter {
  entityType?: DocumentLinkInput["entityType"];
  entityId?: string;
  propertyId?: string;
  category?: DocumentCategory;
  q?: string;
  includeDeleted?: boolean;
}

export async function listDocuments(ctx: Ctx, filter: DocumentFilter = {}): Promise<DocumentView[]> {
  requirePermission(ctx.principal, "documents.read", filter.propertyId ? { propertyId: filter.propertyId } : undefined);
  let q = ctx.trx.selectFrom("documents").selectAll().orderBy("created_at", "desc").limit(500);
  if (!filter.includeDeleted) q = q.where("deleted_at", "is", null);
  if (filter.category) q = q.where("category", "=", filter.category);
  if (filter.q) q = q.where("title", "ilike", `%${filter.q.trim()}%`);
  if (filter.entityType && filter.entityId) {
    q = q.where("id", "in", (eb) => eb.selectFrom("document_links").select("document_id").where("entity_type", "=", filter.entityType!).where("entity_id", "=", filter.entityId!));
  }
  if (filter.propertyId) {
    q = q.where("id", "in", (eb) => eb.selectFrom("document_links").select("document_id").where("property_id", "=", filter.propertyId!));
  }
  const docs = await q.execute();
  return Promise.all(docs.map((d) => toView(ctx, d)));
}

export async function addDocumentVersion(ctx: Ctx, storage: DocumentStorage, id: string, file: { filename: string; data: Buffer }): Promise<DocumentView> {
  const doc = await loadDoc(ctx, id);
  if (doc.deleted_at) throw new ConflictError("Das Dokument ist gelöscht.");
  requireWriteFor(ctx, await writableProperty(ctx, id));
  const next = doc.current_version + 1;
  await storeVersion(ctx, storage, id, next, file);
  const updated = await ctx.trx.updateTable("documents").set({ current_version: next }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  return toView(ctx, updated);
}

export async function readDocumentContent(ctx: Ctx, storage: DocumentStorage, id: string, version?: number): Promise<{ filename: string; mimeType: string; data: Buffer }> {
  requirePermission(ctx.principal, "documents.read");
  const doc = await loadDoc(ctx, id);
  const v = await ctx.trx
    .selectFrom("document_versions")
    .selectAll()
    .where("document_id", "=", id)
    .where("version", "=", version ?? doc.current_version)
    .executeTakeFirst();
  if (!v) throw new NotFoundError("Dokumentversion");
  const data = await storage.get(v.storage_key);
  // Integrity check on every read (revisionssichere Ablage).
  if (createHash("sha256").update(data).digest("hex") !== v.sha256) throw new Error(`Prüfsumme von Dokument ${id} v${v.version} stimmt nicht`);
  return { filename: v.filename, mimeType: v.mime_type, data };
}

export async function linkDocument(ctx: Ctx, id: string, link: DocumentLinkInput): Promise<DocumentView> {
  const doc = await loadDoc(ctx, id);
  const target = await resolveLink(ctx, link);
  if (link.entityType === "person") target.propertyId = (await writableProperty(ctx, id)).propertyId;
  requireWriteFor(ctx, target);
  await ctx.trx
    .insertInto("document_links")
    .values({ tenant_id: ctx.principal.tenantId, document_id: id, entity_type: link.entityType, entity_id: link.entityId, property_id: target.propertyId })
    .onConflict((oc) => oc.columns(["document_id", "entity_type", "entity_id"]).doNothing())
    .execute();
  return toView(ctx, doc);
}

export async function unlinkDocument(ctx: Ctx, id: string, linkId: string): Promise<DocumentView> {
  const doc = await loadDoc(ctx, id);
  const link = await ctx.trx.selectFrom("document_links").selectAll().where("id", "=", linkId).where("document_id", "=", id).executeTakeFirst();
  if (!link) throw new NotFoundError("Verknüpfung", linkId);
  requireWriteFor(ctx, { propertyId: link.property_id });
  const count = await ctx.trx.selectFrom("document_links").select((eb) => eb.fn.countAll<string>().as("n")).where("document_id", "=", id).executeTakeFirstOrThrow();
  if (Number(count.n) <= 1) throw new ValidationError("Ein Dokument muss in mindestens einer Akte liegen.");
  await ctx.trx.deleteFrom("document_links").where("id", "=", linkId).execute();
  return toView(ctx, doc);
}

/** Soft delete; refused while a statutory retention period runs. Content is kept. */
export async function deleteDocument(ctx: Ctx, id: string): Promise<DocumentView> {
  const doc = await loadDoc(ctx, id);
  requireWriteFor(ctx, await writableProperty(ctx, id));
  if (doc.retention_until && doc.retention_until >= ctx.today) {
    throw new ConflictError(`Das Dokument unterliegt einer Aufbewahrungsfrist bis ${doc.retention_until.split("-").reverse().join(".")} und kann nicht gelöscht werden.`);
  }
  const updated = await ctx.trx.updateTable("documents").set({ deleted_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  return toView(ctx, updated);
}
