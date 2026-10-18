import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import type { Deadline } from "../api/queries";
import { formatDate } from "../lib/format";
import { DEADLINE_KIND } from "../lib/labels";
import { Badge, DeadlineStatusBadge, EmptyState } from "../ui/components";

const SUBJECT_NOUN: Record<string, [string, string]> = {
  meter_calibration: ["Zähler", "Zähler"],
  meter_remote_retrofit: ["Zähler", "Zähler"],
  meter_interoperability: ["Zähler", "Zähler"],
};

interface Group {
  key: string;
  first: Deadline;
  items: Deadline[];
}

/** Identical deadlines (same kind, property, date, status) collapse into one row, e.g. 12 meters with the same calibration date. */
function group(items: Deadline[]): Group[] {
  const map = new Map<string, Group>();
  for (const d of items) {
    const key = `${d.kind}|${d.propertyId}|${d.dueDate}|${d.status}`;
    const g = map.get(key);
    if (g) g.items.push(d);
    else map.set(key, { key, first: d, items: [d] });
  }
  return [...map.values()];
}

function Sources({ d }: { d: Deadline }) {
  return (
    <div className="row" style={{ gap: 6, marginTop: 4 }}>
      {d.rule.sources.map((s) =>
        s.url ? (
          <a key={s.label} href={s.url} target="_blank" rel="noreferrer">
            {s.norm ?? s.label}
            <ExternalLink size={12} aria-hidden="true" />
            <span className="visually-hidden"> (öffnet neues Fenster)</span>
          </a>
        ) : (
          <span key={s.label}>{s.norm ?? s.label}</span>
        ),
      )}
      {d.rule.rechtPruefen.map((r) => (
        <Badge key={r}>RECHT-PRÜFEN {r}</Badge>
      ))}
    </div>
  );
}

export function DeadlineTable({ items, showProperty = true, highlight }: { items: Deadline[]; showProperty?: boolean; highlight?: string | null }) {
  if (items.length === 0) return <EmptyState title="Keine Fristen">Für diese Auswahl ergeben sich aus den Stammdaten keine Fristen.</EmptyState>;
  const groups = group(items);
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Fristen, dringendste zuerst</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Fällig</th>
            <th scope="col">Frist</th>
            {showProperty && <th scope="col">Objekt</th>}
            <th scope="col">Grundlage</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ key, first: d, items: members }) => {
            const noun = SUBJECT_NOUN[d.kind];
            const highlighted = highlight && members.some((m) => m.id === highlight);
            return (
              <tr key={key} id={`frist-${members.find((m) => m.id === highlight)?.id ?? d.id}`} style={highlighted ? { outline: "2px solid var(--focus)" } : undefined}>
                <td>
                  <DeadlineStatusBadge status={d.status} />
                </td>
                <td className="num">
                  {formatDate(d.dueDate)}
                  {d.businessDay.shifted && (
                    <div className="small muted" title={d.businessDay.reason ?? undefined}>
                      § 193 BGB: {formatDate(d.businessDay.date)}
                    </div>
                  )}
                  <div className="small muted">Vorwarnung ab {formatDate(d.warnFrom)}</div>
                </td>
                <td>
                  <strong>{d.title}</strong>
                  {members.length === 1 ? (
                    <div className="small muted">{d.subject.label}</div>
                  ) : (
                    <details>
                      <summary className="small">
                        {members.length} {noun ? noun[1] : "Einträge"}
                      </summary>
                      <div className="small muted">{members.map((m) => m.subject.label).join(", ")}</div>
                    </details>
                  )}
                </td>
                {showProperty && (
                  <td>
                    <Link to={`/objekte/${d.propertyId}?ansicht=fristen`}>{d.propertyLabel}</Link>
                  </td>
                )}
                <td className="small" style={{ minWidth: 240 }}>
                  <div>{members.length === 1 ? d.basis : DEADLINE_KIND[d.kind]}</div>
                  <Sources d={d} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
