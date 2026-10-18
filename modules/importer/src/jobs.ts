import { requirePermission } from "@hv/access";
import { ConflictError, NotFoundError, ValidationError } from "@hv/core";
import { sql, type Row } from "@hv/db";
import type { Ctx } from "@hv/masterdata";
import { executeImport } from "./execute";
import { ENTITIES, type EntityKey } from "./fields";
import { suggestMapping, type SheetMapping } from "./mapping";
import { parseFiles, type Sheet, type SourceFileInfo, type UploadedFile } from "./parse";
import { IssueCollector, type EntityCounts, type ImportReport } from "./report";
import { checkRecords, toRecords } from "./transform";

export interface ImportSheetView {
  name: string;
  entity: EntityKey | null;
  entityConfidence: number;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  columns: Record<string, string | null>;
  columnConfidence: Record<string, number>;
}

export interface ImportJobView {
  id: string;
  status: "analyzed" | "validated" | "committed" | "failed";
  source: string;
  createdAt: string;
  committedAt: string | null;
  sourceFiles: SourceFileInfo[];
  sheets: ImportSheetView[];
  report: ImportReport | null;
  summary: ImportReport | null;
}

interface JobData {
  source: string;
  sheets: Sheet[];
}

interface StoredMapping {
  sheets: Array<SheetMapping & { confidence: number; columnConfidence: Record<string, number> }>;
}

function toView(row: Row<"import_jobs">): ImportJobView {
  const data = row.data as JobData;
  const mapping = row.mapping as StoredMapping;
  return {
    id: row.id,
    status: row.status,
    source: data.source,
    createdAt: row.created_at.toISOString(),
    committedAt: row.committed_at ? new Date(row.committed_at).toISOString() : null,
    sourceFiles: row.source_files as SourceFileInfo[],
    sheets: data.sheets.map((sheet) => {
      const m = mapping.sheets.find((x) => x.sheet === sheet.name);
      return {
        name: sheet.name,
        entity: m?.entity ?? null,
        entityConfidence: m?.confidence ?? 0,
        headers: sheet.headers,
        rowCount: sheet.rows.length,
        sampleRows: sheet.rows.slice(0, 5),
        columns: m?.columns ?? {},
        columnConfidence: m?.columnConfidence ?? {},
      };
    }),
    report: (row.report as ImportReport | null) ?? null,
    summary: (row.summary as ImportReport | null) ?? null,
  };
}

async function loadJob(ctx: Ctx, id: string): Promise<Row<"import_jobs">> {
  const row = await ctx.trx.selectFrom("import_jobs").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError("Import", id);
  return row;
}

/** Step 1: upload and analyse – entity detection and column suggestions. */
export async function createImportJob(ctx: Ctx, files: UploadedFile[], options: { source?: string } = {}): Promise<ImportJobView> {
  requirePermission(ctx.principal, "import.run");
  const source = (options.source ?? "import").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60) || "import";
  const { sheets, sources } = await parseFiles(files);
  const mapping: StoredMapping = { sheets: sheets.map(suggestMapping) };
  const row = await ctx.trx
    .insertInto("import_jobs")
    .values({
      tenant_id: ctx.principal.tenantId,
      created_by: ctx.principal.userId,
      status: "analyzed",
      source_files: JSON.stringify(sources),
      mapping: JSON.stringify(mapping),
      data: JSON.stringify({ source, sheets } satisfies JobData),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toView(row);
}

export async function getImportJob(ctx: Ctx, id: string): Promise<ImportJobView> {
  requirePermission(ctx.principal, "import.run");
  return toView(await loadJob(ctx, id));
}

export async function listImportJobs(ctx: Ctx): Promise<Array<Omit<ImportJobView, "sheets">>> {
  requirePermission(ctx.principal, "import.run");
  const rows = await ctx.trx.selectFrom("import_jobs").selectAll().orderBy("created_at", "desc").limit(50).execute();
  return rows.map((r) => {
    const { sheets: _sheets, ...rest } = toView(r);
    return rest;
  });
}

/** Step 2: the user confirms or corrects entity and column mapping. */
export async function updateImportMapping(ctx: Ctx, id: string, sheets: Array<{ sheet: string; entity: EntityKey | null; columns: Record<string, string | null> }>): Promise<ImportJobView> {
  requirePermission(ctx.principal, "import.run");
  const job = await loadJob(ctx, id);
  if (job.status === "committed") throw new ConflictError("Dieser Import wurde bereits übernommen.");
  const data = job.data as JobData;
  const stored = job.mapping as StoredMapping;
  const issues: Array<{ path: string; message: string }> = [];
  for (const m of sheets) {
    const sheet = data.sheets.find((s) => s.name === m.sheet);
    if (!sheet) {
      issues.push({ path: m.sheet, message: "Unbekannte Tabelle" });
      continue;
    }
    const fields = m.entity ? new Set(ENTITIES[m.entity].fields.map((f) => f.key)) : new Set<string>();
    const used = new Set<string>();
    for (const [header, field] of Object.entries(m.columns)) {
      if (!sheet.headers.includes(header)) issues.push({ path: `${m.sheet}.${header}`, message: "Spalte gibt es nicht" });
      if (field === null) continue;
      if (!fields.has(field)) issues.push({ path: `${m.sheet}.${header}`, message: `Feld „${field}“ gehört nicht zu dieser Datenart` });
      if (used.has(field)) issues.push({ path: `${m.sheet}.${header}`, message: `Feld „${field}“ ist mehrfach zugeordnet` });
      used.add(field);
    }
  }
  if (issues.length) throw new ValidationError("Die Zuordnung ist ungültig.", issues);
  const next: StoredMapping = {
    sheets: stored.sheets.map((s) => {
      const update = sheets.find((m) => m.sheet === s.sheet);
      return update ? { ...s, entity: update.entity, columns: { ...s.columns, ...update.columns }, confidence: 1 } : s;
    }),
  };
  const row = await ctx.trx
    .updateTable("import_jobs")
    .set({ mapping: JSON.stringify(next), status: "analyzed", report: null })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return toView(row);
}

async function run(ctx: Ctx, job: Row<"import_jobs">, dryRun: boolean): Promise<ImportReport> {
  const started = Date.now();
  const data = job.data as JobData;
  const mapping = job.mapping as StoredMapping;
  const issues = new IssueCollector();
  const records = toRecords(data.sheets, mapping.sheets, issues);
  checkRecords(records, issues);
  let counts: Record<EntityKey, EntityCounts>;
  if (dryRun) {
    // Probeimport (V20): the real import runs and is rolled back to this savepoint.
    await sql`SAVEPOINT import_dry_run`.execute(ctx.trx);
    try {
      counts = await executeImport(ctx, records, issues, { source: data.source, continueOnError: true });
    } finally {
      await sql`ROLLBACK TO SAVEPOINT import_dry_run`.execute(ctx.trx);
    }
  } else {
    if (issues.errors > 0) throw new ValidationError("Der Import enthält Fehler. Bitte zuerst prüfen.");
    counts = await executeImport(ctx, records, issues, { source: data.source, continueOnError: false });
  }
  return { ok: issues.errors === 0, dryRun, counts, errors: issues.errors, warnings: issues.warnings, issues: issues.issues, durationMs: Date.now() - started };
}

/** Step 3: validation report incl. dry run against the real database. */
export async function validateImportJob(ctx: Ctx, id: string): Promise<ImportJobView> {
  requirePermission(ctx.principal, "import.run");
  const job = await loadJob(ctx, id);
  if (job.status === "committed") throw new ConflictError("Dieser Import wurde bereits übernommen.");
  const report = await run(ctx, job, true);
  const row = await ctx.trx
    .updateTable("import_jobs")
    .set({ report: JSON.stringify(report), status: report.ok ? "validated" : "analyzed" })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return toView(row);
}

/** Step 4: commit. All or nothing; the audit log marks every change as `import`. */
export async function commitImportJob(ctx: Ctx, id: string): Promise<ImportJobView> {
  requirePermission(ctx.principal, "import.run");
  const job = await loadJob(ctx, id);
  if (job.status === "committed") throw new ConflictError("Dieser Import wurde bereits übernommen.");
  if (job.status !== "validated") throw new ConflictError("Bitte den Import zuerst prüfen (Probeimport ohne Fehler).");
  const summary = await run(ctx, job, false);
  const row = await ctx.trx
    .updateTable("import_jobs")
    .set({ status: "committed", summary: JSON.stringify(summary), committed_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return toView(row);
}
