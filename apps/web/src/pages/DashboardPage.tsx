import type { ReactNode } from "react";
import { Building2, DoorOpen, FileUp, Home, Users } from "lucide-react";
import { Link } from "react-router";
import { type Dashboard, useCan, useDashboard, useMe } from "../api/queries";
import { PROPERTY_KIND } from "../lib/labels";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../layout/usePageTitle";
import { Card, DeadlineStatusBadge, EmptyState, ErrorNotice, Help, PageHeader, Spinner, TrafficLight, deadlineStatusText, type DeadlineStatus } from "../ui/components";

function Tile({ label, value, icon, hint }: { label: string; value: number | string; icon: ReactNode; hint?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">
        {icon}
        {label}
      </span>
      <span className="tile-value">{value}</span>
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

const ORDER: DeadlineStatus[] = ["overdue", "critical", "warn", "ok"];

/** Part-to-whole of deadline states: one stacked bar, status colors with icon + label legend. */
function DeadlineBar({ counts }: { counts: NonNullable<Dashboard["deadlines"]> }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0);
  if (total === 0) return <EmptyState title="Keine Fristen">Fristen entstehen aus Anlagen, Zählern und Abrechnungszeiträumen.</EmptyState>;
  return (
    <figure style={{ margin: 0 }}>
      <div className="stackbar">
        {ORDER.filter((k) => counts[k] > 0).map((k) => (
          // Hover and keyboard focus show the value; the legend below carries the same numbers as text.
          <span key={k} className={`stackbar-seg ${k}`} style={{ flex: counts[k] }} tabIndex={0} role="img" aria-label={`${deadlineStatusText[k]}: ${counts[k]} von ${total}`}>
            <span className="chart-tooltip seg-tip" aria-hidden="true">
              <strong>{deadlineStatusText[k]}</strong>: {counts[k]} von {total} ({Math.round((counts[k] / total) * 100)} %)
            </span>
          </span>
        ))}
      </div>
      <ul className="legend">
        {ORDER.map((k) => (
          <li key={k}>
            <DeadlineStatusBadge status={k} /> <span className="num">{counts[k]}</span>
          </li>
        ))}
      </ul>
      <figcaption className="visually-hidden">Verteilung der {total} Fristen nach Dringlichkeit</figcaption>
    </figure>
  );
}

export function DashboardPage() {
  usePageTitle("Start");
  const me = useMe();
  const can = useCan();
  const dashboard = useDashboard();
  if (dashboard.isPending) return <Spinner />;
  if (dashboard.isError) return <ErrorNotice error={dashboard.error} />;
  const d = dashboard.data;
  const staff = can("deadlines.read");

  return (
    <div className="stack">
      <PageHeader
        title={`Guten Tag, ${me.data?.user.displayName.split(" ")[0] ?? ""}`}
        description={staff ? "Was heute ansteht: Fristen nach Dringlichkeit und wie vollständig Ihre Objekte erfasst sind." : "Ihre Objekte und Einheiten auf einen Blick."}
        actions={
          can("import.run") ? (
            <Link className="btn" to="/import">
              <FileUp size={16} aria-hidden="true" />
              Daten importieren
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-kpi">
        <Tile label="Objekte" value={d.counts.properties} icon={<Building2 size={16} aria-hidden="true" />} />
        <Tile label="Einheiten" value={d.counts.units} icon={<Home size={16} aria-hidden="true" />} />
        {d.counts.persons !== null && <Tile label="Personen" value={d.counts.persons} icon={<Users size={16} aria-hidden="true" />} />}
        {staff && <Tile label="Leerstand" value={d.counts.vacantUnits} icon={<DoorOpen size={16} aria-hidden="true" />} hint="Wohn- und Gewerbeeinheiten ohne aktuellen Mieter" />}
      </div>

      {d.deadlines && (
        <div className="grid grid-2">
          <Card title="Fristen nach Dringlichkeit" actions={<Link to="/fristen">Alle Fristen</Link>}>
            <DeadlineBar counts={d.deadlines} />
          </Card>
          <Card title="Als Nächstes fällig">
            {d.nextDeadlines.length === 0 ? (
              <EmptyState title="Nichts Dringendes">Alle Fristen sind im Plan.</EmptyState>
            ) : (
              <ul className="next-list">
                {d.nextDeadlines.map((x) => (
                  <li key={x.id}>
                    <div>
                      <Link to={`/fristen?id=${encodeURIComponent(x.id)}`}>{x.title}</Link>
                      <div className="small muted">
                        {x.propertyLabel} · {x.subject.label}
                      </div>
                    </div>
                    <div className="next-list-status">
                      <DeadlineStatusBadge status={x.status} />
                      <div className="small num">bis {formatDate(x.dueDate)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {staff && (
        <Card title="Vollständigkeit je Objekt">
          <p className="small muted" style={{ marginTop: 0 }}>
            Anteil erfüllter Prüfpunkte (Anschrift, Flächen, MEA, Eigentümer, Technik). Ohne Pflichtangaben stimmen Abrechnungen und Fristen nicht.
          </p>
          <ul className="meter-list">
            {d.properties.map((p) => (
              <li key={p.id} className="meter">
                <span>
                  <Link to={`/objekte/${p.id}`}>
                    {p.code} · {p.name}
                  </Link>{" "}
                  <span className="muted small">{PROPERTY_KIND[p.kind]}</span>
                </span>
                <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.completenessScore} aria-label={`Vollständigkeit ${p.name}`}>
                  <div className="meter-fill" style={{ width: `${p.completenessScore}%` }} />
                </div>
                <span className="num" style={{ textAlign: "right" }}>
                  {p.completenessScore} %
                </span>
                <span className="small">
                  <TrafficLight light={p.completenessTrafficLight} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Help>
        Die Startseite zeigt nur, was Sie sehen dürfen. Mit <kbd>Strg</kbd> + <kbd>K</kbd> springen Sie direkt zu Objekten, Personen und Seiten. Fristen berechnet das
        System aus den Stammdaten und dem Regelkatalog; die Ampel richtet sich immer nach dem gesetzlichen Datum, ohne Verschiebung auf den nächsten Werktag.
      </Help>
    </div>
  );
}
