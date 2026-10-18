import { Plus } from "lucide-react";
import { useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { Link, useParams, useSearchParams } from "react-router";
import { api, unwrap } from "../api/client";
import { type PropertyOverview, useApiMutation, useCan, useOverview } from "../api/queries";
import { formatArea, formatDate, formatDecimal, toApiDecimal, isoToday, parseGermanDate } from "../lib/format";
import { ASSET_KIND, ENERGY_CARRIER, METER_KIND, PERSON_ROLE, PROPERTY_KIND_LONG, STATES, UNIT_TYPE, unitTypeOptions } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Button, Card, EmptyState, ErrorNotice, ModalDialog, PageHeader, SelectField, Spinner, TextField, TrafficLight } from "../ui/components";
import { DeadlineTable } from "./DeadlineTable";
import { DocumentsPanel } from "./DocumentsPanel";

const TABS = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "einheiten", label: "Einheiten" },
  { id: "technik", label: "Technik" },
  { id: "dokumente", label: "Dokumente" },
  { id: "fristen", label: "Fristen" },
];

export function PropertyPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const overview = useOverview(id);
  usePageTitle(overview.data?.property.name ?? "Objekt");
  const tab = TABS.some((t) => t.id === params.get("ansicht")) ? params.get("ansicht")! : "uebersicht";

  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorNotice error={overview.error} />;
  const o = overview.data;
  const p = o.property;

  return (
    <div className="stack">
      <nav aria-label="Brotkrumen" className="small">
        <Link to="/objekte">Objekte</Link> › {p.code}
      </nav>
      <PageHeader
        title={`${p.code} · ${p.name}`}
        description={
          <>
            {PROPERTY_KIND_LONG[p.kind]} · {[p.street && `${p.street} ${p.houseNumber ?? ""}`, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            {p.state ? ` · ${STATES[p.state]}` : ""}
          </>
        }
        actions={<TrafficLight light={o.completeness.trafficLight} label={`Vollständigkeit ${o.completeness.score} %`} />}
      />
      {/* Tabs are part of the URL: deep links and the browser back button work (V32). */}
      <Tabs className="tabs" selectedKey={tab} onSelectionChange={(k) => setParams({ ansicht: String(k) }, { replace: false })}>
        <TabList aria-label="Bereiche des Objekts">
          {TABS.map((t) => (
            <Tab key={t.id} id={t.id} className="tab">
              {t.label}
              {t.id === "einheiten" && ` (${o.totals.units})`}
              {t.id === "fristen" && o.deadlines.length > 0 && ` (${o.deadlines.length})`}
            </Tab>
          ))}
        </TabList>
        <TabPanel id="uebersicht">
          <OverviewTab o={o} />
        </TabPanel>
        <TabPanel id="einheiten">
          <UnitsTab o={o} />
        </TabPanel>
        <TabPanel id="technik">
          <TechTab o={o} />
        </TabPanel>
        <TabPanel id="dokumente">
          <DocumentsPanel entityType="property" entityId={p.id} propertyId={p.id} />
        </TabPanel>
        <TabPanel id="fristen">
          <DeadlineTable items={o.deadlines} showProperty={false} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function OverviewTab({ o }: { o: PropertyOverview }) {
  const p = o.property;
  return (
    <div className="stack">
      <div className="grid grid-kpi">
        <div className="tile">
          <span className="tile-label">Einheiten</span>
          <span className="tile-value">{o.totals.units}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Wohnfläche gesamt</span>
          <span className="tile-value">{formatArea(o.totals.livingArea)}</span>
        </div>
        {o.totals.usableArea !== "0" && (
          <div className="tile">
            <span className="tile-label">Nutzfläche gesamt</span>
            <span className="tile-value">{formatArea(o.totals.usableArea)}</span>
          </div>
        )}
        {p.kind !== "rental" && (
          <div className="tile">
            <span className="tile-label">Miteigentumsanteile</span>
            <span className="tile-value num">
              {formatDecimal(o.totals.meaSum)} / {p.meaDenominator ? formatDecimal(String(p.meaDenominator)) : "–"}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-2">
        <Card title="Vollständigkeit">
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
            {o.completeness.checks.map((c) => (
              <li key={c.key} className="spread" style={{ alignItems: "flex-start" }}>
                <div>
                  {c.label}
                  {c.detail && <div className="small muted">{c.detail}</div>}
                </div>
                <TrafficLight light={c.ok ? "green" : c.severity === "required" ? "red" : "yellow"} label={c.ok ? "erfüllt" : c.severity === "required" ? "fehlt (Pflicht)" : "fehlt (empfohlen)"} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Nächste Fristen">
          {o.deadlines.length === 0 ? (
            <EmptyState title="Keine Fristen" />
          ) : (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
              {o.deadlines.slice(0, 5).map((d) => (
                <li key={d.id} className="spread">
                  <span>{d.title}</span>
                  <span className="num small">{formatDate(d.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Gebäude">
        {o.buildings.length === 0 ? (
          <EmptyState title="Kein Gebäude erfasst" />
        ) : (
          <ul style={{ margin: 0 }}>
            {o.buildings.map((b) => (
              <li key={b.id}>
                {b.name}
                {b.yearBuilt ? `, Baujahr ${b.yearBuilt}` : ""}
                {b.usage !== "residential" ? ` (${b.usage === "mixed" ? "gemischt genutzt" : "Nichtwohngebäude"})` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function UnitsTab({ o }: { o: PropertyOverview }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const isWeg = o.property.kind !== "rental";
  return (
    <div className="stack">
      {can("masterdata.write") && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="primary" onPress={() => setOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Einheit anlegen
          </Button>
        </div>
      )}
      {o.units.length === 0 ? (
        <EmptyState title="Keine Einheiten" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Einheiten mit Flächen zum heutigen Stichtag</caption>
            <thead>
              <tr>
                <th scope="col">Einheit</th>
                <th scope="col">Typ</th>
                <th scope="col">Lage</th>
                <th scope="col" className="num">
                  Wohnfläche
                </th>
                <th scope="col" className="num">
                  Nutzfläche
                </th>
                {isWeg && (
                  <th scope="col" className="num">
                    MEA
                  </th>
                )}
                <th scope="col">Personen</th>
              </tr>
            </thead>
            <tbody>
              {o.units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/einheiten/${u.id}`}>{u.number}</Link>
                  </td>
                  <td>{UNIT_TYPE[u.type]}</td>
                  <td>{[u.floor, u.position].filter(Boolean).join(", ") || "–"}</td>
                  <td className="num">{formatArea(u.measures.living_area)}</td>
                  <td className="num">{formatArea(u.measures.usable_area)}</td>
                  {isWeg && <td className="num">{formatDecimal(u.measures.mea)}</td>}
                  <td className="small">
                    {u.occupants.length === 0
                      ? o.property.kind === "weg"
                        ? "–"
                        : "Leerstand"
                      : u.occupants.map((x) => (
                          <div key={`${x.personId}:${x.role}`}>
                            <Link to={`/personen/${x.personId}`}>{x.displayName}</Link> <span className="muted">({PERSON_ROLE[x.role]}{x.share ? ` ${x.share}` : ""})</span>
                          </div>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateUnitDialog isOpen={open} onClose={() => setOpen(false)} o={o} />
    </div>
  );
}

function CreateUnitDialog({ isOpen, onClose, o }: { isOpen: boolean; onClose: () => void; o: PropertyOverview }) {
  const [form, setForm] = useState({ number: "", type: "apartment", buildingId: o.buildings[0]?.id ?? "", floor: "", livingArea: "", mea: "", validFrom: formatDate(`${isoToday().slice(0, 4)}-01-01`) });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const validFrom = parseGermanDate(form.validFrom);
  const mutation = useApiMutation(() =>
    unwrap(
      api.POST("/v1/properties/{id}/units", {
        params: { path: { id: o.property.id } },
        body: {
          number: form.number,
          type: form.type as "apartment",
          buildingId: form.buildingId || null,
          floor: form.floor || null,
          measures: [
            ...(form.livingArea && validFrom ? [{ measure: "living_area" as const, value: toApiDecimal(form.livingArea), validFrom }] : []),
            ...(form.mea && validFrom ? [{ measure: "mea" as const, value: toApiDecimal(form.mea), validFrom }] : []),
          ],
        },
      }),
    ),
  );
  return (
    <ModalDialog isOpen={isOpen} onOpenChange={(v) => !v && onClose()} title="Einheit anlegen">
      {(close) => (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(undefined, { onSuccess: () => close() });
          }}
        >
          <div className="form-grid">
            <TextField label="Einheit" value={form.number} onChange={set("number")} isRequired autoFocus placeholder="z. B. WE 07" />
            <SelectField label="Typ" options={unitTypeOptions} value={form.type} onChange={set("type")} isRequired />
            {o.buildings.length > 0 && (
              <SelectField label="Gebäude" options={o.buildings.map((b) => ({ id: b.id, label: b.name }))} value={form.buildingId || null} onChange={set("buildingId")} />
            )}
            <TextField label="Etage" value={form.floor} onChange={set("floor")} />
          </div>
          <div className="form-grid">
            <TextField label="Wohnfläche (m²)" value={form.livingArea} onChange={set("livingArea")} inputMode="decimal" placeholder="62,50" />
            {o.property.kind !== "rental" && <TextField label="MEA" value={form.mea} onChange={set("mea")} inputMode="decimal" />}
            <TextField label="Gültig ab" value={form.validFrom} onChange={set("validFrom")} error={form.validFrom && !validFrom ? "Datum als TT.MM.JJJJ" : undefined} />
          </div>
          {mutation.isError && <ErrorNotice error={mutation.error} title="Einheit konnte nicht angelegt werden" />}
          <div className="dialog-actions">
            <Button onPress={close}>Abbrechen</Button>
            <Button type="submit" variant="primary" isDisabled={mutation.isPending || !form.number}>
              Anlegen
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}

/** Retrofit date comes from the rule engine via the deadline, never from UI code. */
function retrofitDue(o: PropertyOverview, meterId: string): string | undefined {
  return o.deadlines.find((d) => d.kind === "meter_remote_retrofit" && d.subject.id === meterId)?.dueDate;
}

function TechTab({ o }: { o: PropertyOverview }) {
  return (
    <div className="stack">
      <Card title="Anlagen">
        {o.assets.length === 0 ? (
          <EmptyState title="Keine Anlagen erfasst">Heizung, Trinkwasser und Rauchwarnmelder steuern Fristen und Kostenregeln.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Anlage</th>
                  <th scope="col">Art</th>
                  <th scope="col">Energieträger</th>
                  <th scope="col">Einbau</th>
                  <th scope="col">Letzte Prüfung</th>
                </tr>
              </thead>
              <tbody>
                {o.assets.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      {a.kind === "drinking_water" && typeof a.attributes.largeSystem === "boolean" && (
                        <div className="small muted">{a.attributes.largeSystem ? "Großanlage (TrinkwV)" : "keine Großanlage"}</div>
                      )}
                    </td>
                    <td>{ASSET_KIND[a.kind]}</td>
                    <td>{a.energyCarrier ? ENERGY_CARRIER[a.energyCarrier] : "–"}</td>
                    <td className="num">{formatDate(a.installedOn)}</td>
                    <td className="num">{formatDate(a.lastInspectionOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Zähler">
        {o.meters.length === 0 ? (
          <EmptyState title="Keine Zähler erfasst" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Zählernummer</th>
                  <th scope="col">Art</th>
                  <th scope="col">Einheit</th>
                  <th scope="col">Fernablesbar</th>
                  <th scope="col">Eichung bis</th>
                </tr>
              </thead>
              <tbody>
                {o.meters.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{m.serialNumber}</td>
                    <td>{METER_KIND[m.kind]}</td>
                    <td>{o.units.find((u) => u.id === m.unitId)?.number ?? "Allgemein"}</td>
                    <td>
                      {m.remoteReadable ? (
                        m.interoperable ? (
                          "ja, interoperabel"
                        ) : (
                          "ja"
                        )
                      ) : (
                        <Badge>nein{retrofitDue(o, m.id) ? ` – Umrüstung bis ${formatDate(retrofitDue(o, m.id))}` : ""}</Badge>
                      )}
                    </td>
                    <td className="num">{formatDate(m.calibrationValidUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
