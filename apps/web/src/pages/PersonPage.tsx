import { Link, useParams } from "react-router";
import { usePerson, useProperties } from "../api/queries";
import { addDays, formatDate, isoToday } from "../lib/format";
import { PERSON_ROLE } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, Spinner } from "../ui/components";
import { DocumentsPanel } from "./DocumentsPanel";

export function PersonPage() {
  const { id = "" } = useParams();
  const person = usePerson(id);
  const properties = useProperties();
  usePageTitle(person.data?.displayName ?? "Person");
  if (person.isPending) return <Spinner />;
  if (person.isError) return <ErrorNotice error={person.error} />;
  const p = person.data;
  const propertyName = (pid: string) => properties.data?.items.find((x) => x.id === pid);

  return (
    <div className="stack">
      <nav aria-label="Brotkrumen" className="small">
        <Link to="/personen">Personen</Link> › {p.displayName}
      </nav>
      <PageHeader title={p.displayName} description={p.kind === "legal" ? "Firma / juristische Person" : "Natürliche Person"} />
      {p.mergedIntoId && (
        <div className="notice notice-warning">
          Diese Person wurde zusammengeführt. <Link to={`/personen/${p.mergedIntoId}`}>Zur zusammengeführten Person</Link>
        </div>
      )}
      <div className="grid grid-2">
        <Card title="Kontakt">
          <dl className="dl">
            <dt>E-Mail</dt>
            <dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "–"}</dd>
            <dt>Telefon</dt>
            <dd>{p.phone ?? "–"}</dd>
            <dt>Anschrift</dt>
            <dd>{[p.street && `${p.street} ${p.houseNumber ?? ""}`, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}</dd>
            <dt>Kommunikation</dt>
            <dd>{{ email: "E-Mail", letter: "Brief", portal: "Portal" }[p.communicationPreference] ?? p.communicationPreference}</dd>
            {p.birthDate && (
              <>
                <dt>Geburtsdatum</dt>
                <dd>{formatDate(p.birthDate)}</dd>
              </>
            )}
            <dt>IBAN</dt>
            <dd className="num">{p.iban ? p.iban.replace(/(.{4})/g, "$1 ").trim() : "–"}</dd>
          </dl>
          <p className="small muted">Der Aufruf dieser Seite wird im Zugriffsprotokoll vermerkt (Datenschutz).</p>
        </Card>
        <Card title="Rollen">
          {p.roles.length === 0 ? (
            <EmptyState title="Noch keine Rolle" />
          ) : (
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
              {p.roles.map((r) => {
                const prop = propertyName(r.propertyId);
                const ended = r.validTo !== null && r.validTo <= isoToday();
                return (
                  <li key={r.id} className="spread">
                    <div>
                      <strong>{PERSON_ROLE[r.role]}</strong>
                      {r.share ? ` (${r.share})` : ""} · {prop ? <Link to={`/objekte/${prop.id}?ansicht=einheiten`}>{prop.code} {prop.name}</Link> : "Objekt"}
                      <div className="small muted">
                        {r.validFrom ? `seit ${formatDate(r.validFrom)}` : "ohne Beginn"}
                        {r.validTo ? ` · bis ${formatDate(addDays(r.validTo, -1))}` : ""}
                      </div>
                    </div>
                    {ended ? <Badge>beendet</Badge> : <Badge tone="accent">aktuell</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Personenakte">
        <DocumentsPanel entityType="person" entityId={p.id} />
      </Card>
    </div>
  );
}
