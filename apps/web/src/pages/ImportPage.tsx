import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DropZone, FileTrigger } from "react-aria-components";
import { useSearchParams } from "react-router";
import { api, download, unwrap, upload } from "../api/client";
import { type ImportEntity, type ImportJob, useImportFields, useInvalidateAll } from "../api/queries";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Button, Card, ErrorNotice, Help, Notice, PageHeader, SelectField, Spinner, TextField } from "../ui/components";

const STEPS = ["Hochladen", "Zuordnen", "Prüfen", "Übernehmen"];
const ENTITY_LABEL: Record<string, string> = { properties: "Objekte", buildings: "Gebäude", units: "Einheiten", persons: "Personen", roles: "Rollen", assets: "Anlagen", meters: "Zähler" };

type Mapping = Record<string, { entity: string | null; columns: Record<string, string | null> }>;

function fromJob(job: ImportJob): Mapping {
  return Object.fromEntries(job.sheets.map((s) => [s.name, { entity: s.entity, columns: { ...s.columns } }]));
}

export function ImportPage() {
  usePageTitle("Import");
  const [params, setParams] = useSearchParams();
  const jobId = params.get("auftrag");
  const fields = useImportFields();
  const job = useQuery({ queryKey: ["import", jobId], queryFn: () => unwrap(api.GET("/v1/imports/{id}", { params: { path: { id: jobId! } } })), enabled: !!jobId });
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const invalidate = useInvalidateAll();

  useEffect(() => {
    if (job.data) setMapping(fromJob(job.data));
  }, [job.data]);

  const j = job.data;
  const step = !j ? 0 : j.status === "committed" ? 3 : j.report ? 2 : 1;

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndValidate() {
    await run(async () => {
      await unwrap(
        api.PUT("/v1/imports/{id}/mapping", {
          params: { path: { id: j!.id } },
          body: { sheets: Object.entries(mapping).map(([sheet, m]) => ({ sheet, entity: m.entity as "units" | null, columns: m.columns })) },
        }),
      );
      await unwrap(api.POST("/v1/imports/{id}/validate", { params: { path: { id: j!.id } } }));
      await job.refetch();
    });
  }

  async function commit() {
    await run(async () => {
      await unwrap(api.POST("/v1/imports/{id}/commit", { params: { path: { id: j!.id } } }));
      await job.refetch();
      await invalidate();
    });
  }

  return (
    <div className="stack">
      <PageHeader
        title="Import"
        description="Stammdaten aus CSV- oder Excel-Dateien übernehmen – mit Probeimport, bevor etwas gespeichert wird."
        actions={
          <Button onPress={() => run(() => download("/v1/imports/template.xlsx", "importvorlage.xlsx"))}>
            <Download size={16} aria-hidden="true" />
            Vorlage (XLSX)
          </Button>
        }
      />
      <ol className="steps" aria-label="Schritte">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step || (i === 3 && j?.status === "committed") ? "done" : undefined}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error ? <ErrorNotice error={error} /> : null}
      {jobId && job.isPending && <Spinner />}
      {job.isError && <ErrorNotice error={job.error} />}

      {!jobId && <UploadStep onCreated={(id) => setParams({ auftrag: id })} />}

      {j && j.status !== "committed" && fields.data && (
        <MappingStep job={j} entities={fields.data.items} mapping={mapping} onChange={setMapping} onValidate={saveAndValidate} busy={busy} />
      )}

      {j?.report && j.status !== "committed" && (
        <ReportView job={j} report={j.report}>
          {j.report.ok ? (
            <div className="row">
              <Button variant="primary" onPress={commit} isDisabled={busy}>
                <CheckCircle2 size={16} aria-hidden="true" />
                Jetzt übernehmen
              </Button>
              <span className="small muted">Alles oder nichts: Bei einem Fehler wird nichts gespeichert.</span>
            </div>
          ) : (
            <Notice tone="error">Bitte beheben Sie die Fehler in der Datei oder in der Zuordnung und prüfen Sie erneut.</Notice>
          )}
        </ReportView>
      )}

      {j?.status === "committed" && j.summary && (
        <ReportView job={j} report={j.summary}>
          <Notice tone="success">Import übernommen. Jede Änderung steht im Audit-Log mit Herkunft „Import“.</Notice>
          <div>
            <Button onPress={() => setParams({})}>Neuen Import starten</Button>
          </div>
        </ReportView>
      )}

      <Help title="Hinweise zum Import">
        Erlaubt sind CSV (Semikolon, Komma oder Tab, auch Windows-1252) und XLSX mit einem Tabellenblatt je Datenart. Wiederholte Importe sind sicher: Bestehende
        Datensätze werden über Objektnummer, Einheit, Zählernummer und Personennummer erkannt und nur geändert, wo sich Werte unterscheiden – so ist ein Parallelbetrieb
        bis zum Stichtag möglich.
      </Help>
    </div>
  );
}

function UploadStep({ onCreated }: { onCreated: (id: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const add = (list: File[]) => setFiles((f) => [...f, ...list.filter((x) => !f.some((y) => y.name === x.name))]);

  return (
    <Card title="1. Dateien hochladen">
      <div className="stack">
        <DropZone
          className="dropzone"
          aria-label="Importdateien ablegen"
          onDrop={async (e) => add(await Promise.all(e.items.filter((i) => i.kind === "file").map((i) => (i as { getFile: () => Promise<File> }).getFile())))}
        >
          <FileSpreadsheet size={28} aria-hidden="true" />
          <p>CSV- oder XLSX-Dateien hierher ziehen oder</p>
          <FileTrigger allowsMultiple acceptedFileTypes={[".csv", ".xlsx", ".txt"]} onSelect={(list) => list && add([...list])}>
            <Button>Dateien auswählen</Button>
          </FileTrigger>
        </DropZone>
        {files.length > 0 && (
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                {f.name} <span className="muted small">({Math.max(1, Math.round(f.size / 1024))} KB)</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ maxWidth: 360 }}>
          <TextField label="Quelle" value={source} onChange={setSource} placeholder="z. B. Altsystem" description="Name des Altsystems; Personennummern gelten je Quelle" />
        </div>
        {error ? <ErrorNotice error={error} title="Analyse fehlgeschlagen" /> : null}
        <div>
          <Button
            variant="primary"
            isDisabled={files.length === 0 || busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              const form = new FormData();
              if (source) form.set("source", source);
              for (const f of files) form.append("files", f);
              try {
                const job = await upload<{ id: string }>("/v1/imports", form);
                onCreated(job.id);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Upload size={16} aria-hidden="true" />
            Hochladen und analysieren
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MappingStep({
  job,
  entities,
  mapping,
  onChange,
  onValidate,
  busy,
}: {
  job: ImportJob;
  entities: ImportEntity[];
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  onValidate: () => void;
  busy: boolean;
}) {
  const entityOptions = [{ id: "__none", label: "Nicht importieren" }, ...entities.map((e) => ({ id: e.key, label: e.label }))];
  return (
    <Card title="2. Zuordnung prüfen">
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          Das System hat Datenart und Spalten vorgeschlagen. Korrigieren Sie bei Bedarf und starten Sie dann den Probeimport.
        </p>
        {job.sheets.map((sheet) => {
          const m = mapping[sheet.name] ?? { entity: sheet.entity, columns: sheet.columns };
          const entity = entities.find((e) => e.key === m.entity);
          const missing = entity?.fields.filter((f) => f.required && !Object.values(m.columns).includes(f.key)) ?? [];
          const set = (next: Partial<typeof m>) => onChange({ ...mapping, [sheet.name]: { ...m, ...next } });
          return (
            <section key={sheet.name} className="card" aria-label={`Tabelle ${sheet.name}`}>
              <div className="spread">
                <h3>
                  {sheet.name} <span className="muted small">({sheet.rowCount} Zeilen)</span>
                </h3>
                <div style={{ minWidth: 220 }}>
                  <SelectField
                    label="Datenart"
                    options={entityOptions}
                    value={m.entity ?? "__none"}
                    onChange={(v) => set({ entity: v === "__none" ? null : v, columns: v === sheet.entity ? sheet.columns : Object.fromEntries(sheet.headers.map((h) => [h, null])) })}
                  />
                </div>
              </div>
              {missing.length > 0 && <Notice tone="warning">Pflichtspalten noch nicht zugeordnet: {missing.map((f) => f.label).join(", ")}</Notice>}
              {entity && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Spalte in der Datei</th>
                        <th scope="col">Beispiel</th>
                        <th scope="col">Feld</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.headers.map((h, i) => (
                        <tr key={h}>
                          <td>
                            {h}
                            {sheet.columnConfidence[h] !== undefined && sheet.columnConfidence[h]! > 0 && sheet.columns[h] === m.columns[h] && (
                              <div>
                                <Badge>Vorschlag {Math.round(sheet.columnConfidence[h]! * 100)} %</Badge>
                              </div>
                            )}
                          </td>
                          <td className="small muted">{sheet.sampleRows.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · ") || "–"}</td>
                          <td style={{ minWidth: 220 }}>
                            <SelectField
                              label={`Feld für „${h}“`}
                              options={[{ id: "__ignore", label: "Ignorieren" }, ...entity.fields.map((f) => ({ id: f.key, label: `${f.label}${f.required ? " *" : ""}` }))]}
                              value={m.columns[h] ?? "__ignore"}
                              onChange={(v) => set({ columns: { ...m.columns, [h]: v === "__ignore" ? null : v } })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
        <div>
          <Button variant="primary" onPress={onValidate} isDisabled={busy}>
            {busy ? "Prüfe …" : "Prüfen (Probeimport)"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReportView({ job, report, children }: { job: ImportJob; report: NonNullable<ImportJob["report"]>; children: ReactNode }) {
  const committed = job.status === "committed";
  return (
    <Card title={committed ? "4. Übernommen" : "3. Validierungsbericht"}>
      <div className="stack">
        <div className="row">
          {report.ok ? <span className="status status-ok">Keine Fehler</span> : <span className="status status-overdue">{report.errors} Fehler</span>}
          {report.warnings > 0 && <span className="status status-warn">{report.warnings} Hinweise</span>}
          <span className="small muted">Dauer {(report.durationMs / 1000).toFixed(1).replace(".", ",")} s</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Ergebnis je Datenart</caption>
            <thead>
              <tr>
                <th scope="col">Datenart</th>
                <th scope="col" className="num">
                  Neu
                </th>
                <th scope="col" className="num">
                  Geändert
                </th>
                <th scope="col" className="num">
                  Unverändert
                </th>
                <th scope="col" className="num">
                  Fehler
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.counts).map(([k, c]) => (
                <tr key={k}>
                  <td>{ENTITY_LABEL[k] ?? k}</td>
                  <td className="num">{c.created}</td>
                  <td className="num">{c.updated}</td>
                  <td className="num">{c.unchanged}</td>
                  <td className="num">{c.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.issues.length > 0 && (
          <details open={!report.ok}>
            <summary>
              {report.issues.length} Meldungen{report.issues.length < report.errors + report.warnings ? ` (von ${report.errors + report.warnings})` : ""}
            </summary>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Art</th>
                    <th scope="col">Tabelle</th>
                    <th scope="col" className="num">
                      Zeile
                    </th>
                    <th scope="col">Spalte</th>
                    <th scope="col">Meldung</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.severity === "error" ? <span className="status status-overdue">Fehler</span> : <span className="status status-warn">Hinweis</span>}</td>
                      <td className="small">{i.sheet ?? "–"}</td>
                      <td className="num">{i.row ?? "–"}</td>
                      <td className="small">{i.column ?? "–"}</td>
                      <td>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        {children}
      </div>
    </Card>
  );
}
