import { useState } from "react";
import { useAudit } from "../api/queries";
import { formatDateTime } from "../lib/format";
import { AUDIT_ACTION, AUDIT_TABLE } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Button, ErrorNotice, PageHeader, Spinner } from "../ui/components";

const ACTOR: Record<string, string> = { user: "Benutzer", system: "System", import: "Import" };

export function AuditPage() {
  usePageTitle("Audit-Log");
  const [cursor, setCursor] = useState<number[]>([]);
  const beforeId = cursor[cursor.length - 1];
  const audit = useAudit(beforeId ? { beforeId } : {});

  return (
    <div className="stack">
      <PageHeader title="Audit-Log" description="Jede Änderung mit Zeitpunkt, Benutzer und Herkunft – unveränderlich gespeichert." />
      {audit.isPending && <Spinner />}
      {audit.isError && <ErrorNotice error={audit.error} />}
      {audit.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Änderungen, neueste zuerst</caption>
              <thead>
                <tr>
                  <th scope="col">Zeitpunkt</th>
                  <th scope="col">Wer</th>
                  <th scope="col">Was</th>
                  <th scope="col">Änderung</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((e) => (
                  <tr key={e.id}>
                    <td className="num small">{formatDateTime(e.occurredAt)}</td>
                    <td className="small">
                      {e.actorName ?? ACTOR[e.actorKind]}
                      {e.actorKind === "import" && <div className="muted">per Import</div>}
                    </td>
                    <td>
                      {AUDIT_TABLE[e.table] ?? e.table} {AUDIT_ACTION[e.action]}
                      <div className="small muted">{summary(e.newData ?? e.oldData)}</div>
                    </td>
                    <td className="small">
                      {e.action === "update" && e.changedFields ? (
                        <details>
                          <summary>{e.changedFields.join(", ")}</summary>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {e.changedFields.map((f) => (
                              <li key={f}>
                                <code>{f}</code>: {show(e.oldData?.[f])} → {show(e.newData?.[f])}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <Button isDisabled={cursor.length === 0} onPress={() => setCursor((c) => c.slice(0, -1))}>
              Neuere
            </Button>
            <Button isDisabled={!audit.data.nextBeforeId} onPress={() => setCursor((c) => [...c, audit.data!.nextBeforeId!])}>
              Ältere
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "leer";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function summary(data: Record<string, unknown> | null): string {
  if (!data) return "";
  const parts = ["code", "name", "number", "title", "last_name", "company_name", "serial_number", "measure", "value", "role", "status"]
    .map((k) => data[k])
    .filter((v) => v !== null && v !== undefined && v !== "");
  return parts.slice(0, 3).join(" · ");
}
