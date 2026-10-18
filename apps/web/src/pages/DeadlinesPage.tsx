import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useDeadlines } from "../api/queries";
import { usePageTitle } from "../layout/usePageTitle";
import { DEADLINE_KIND } from "../lib/labels";
import { Button, ErrorNotice, Help, PageHeader, SelectField, Spinner, deadlineStatusText, type DeadlineStatus } from "../ui/components";
import { DeadlineTable } from "./DeadlineTable";

const FILTERS: Array<DeadlineStatus | "alle"> = ["alle", "overdue", "critical", "warn", "ok"];

export function DeadlinesPage() {
  usePageTitle("Fristen");
  const [params, setParams] = useSearchParams();
  const deadlines = useDeadlines();
  const status = (params.get("status") ?? "alle") as DeadlineStatus | "alle";
  const kind = params.get("art") ?? "alle";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const byKind = (deadlines.data?.items ?? []).filter((d) => kind === "alle" || d.kind === kind);
  const highlight = params.get("id");
  useEffect(() => {
    if (highlight && deadlines.data) document.getElementById(`frist-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight, deadlines.data]);

  return (
    <div className="stack">
      <PageHeader title="Fristen" description="Aus Stammdaten und Regelkatalog berechnet – kein gesetzlicher Stichtag läuft ohne Vorwarnung ab." />
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="row" role="group" aria-label="Nach Status filtern">
          {FILTERS.map((f) => {
            const count = f === "alle" ? byKind.length : byKind.filter((d) => d.status === f).length;
            return (
              <Button key={f} size="sm" variant={status === f ? "primary" : "secondary"} aria-pressed={status === f} onPress={() => setParam("status", f === "alle" ? null : f)}>
                {f === "alle" ? "Alle" : deadlineStatusText[f]} <span className="num">({count})</span>
              </Button>
            );
          })}
        </div>
        <div style={{ minWidth: 240 }}>
          <SelectField
            label="Art der Frist"
            options={[{ id: "alle", label: "Alle Arten" }, ...Object.entries(DEADLINE_KIND).map(([id, label]) => ({ id, label }))]}
            value={kind}
            onChange={(v) => setParam("art", v === "alle" ? null : v)}
          />
        </div>
      </div>
      {deadlines.isPending && <Spinner />}
      {deadlines.isError && <ErrorNotice error={deadlines.error} />}
      {deadlines.data && <DeadlineTable items={status === "alle" ? byKind : byKind.filter((d) => d.status === status)} highlight={highlight} />}
      <Help>
        Fristen berechnet das System nach §§ 187, 188 BGB. Fällt das Ende auf ein Wochenende oder einen Feiertag, zeigt die Tabelle den Werktag nach § 193 BGB nur zur
        Information. Ampel und Vorwarnung richten sich immer nach dem unverschobenen Datum. Jede Frist nennt ihre Rechtsgrundlage; Punkte mit „RECHT-PRÜFEN“ sind fachlich
        noch abzunehmen.
      </Help>
    </div>
  );
}
