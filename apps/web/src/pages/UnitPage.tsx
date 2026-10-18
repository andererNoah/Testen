import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { api, unwrap } from "../api/client";
import { useApiMutation, useCan, useMeasureHistory, useUnit } from "../api/queries";
import { addDays, formatDate, formatDateTime, formatDecimal, isoToday, parseGermanDate, toApiDecimal } from "../lib/format";
import { MEASURE, UNIT_TYPE, measureOptions } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Button, Card, ErrorNotice, Help, PageHeader, SelectField, Spinner, TextField } from "../ui/components";
import { DocumentsPanel } from "./DocumentsPanel";

export function UnitPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const asOfInput = params.get("stichtag") ?? "";
  const asOf = asOfInput ? (parseGermanDate(asOfInput) ?? undefined) : undefined;
  const unit = useUnit(id, asOf);
  const history = useMeasureHistory(id);
  const can = useCan();
  usePageTitle(unit.data ? `Einheit ${unit.data.number}` : "Einheit");

  if (unit.isPending) return <Spinner />;
  if (unit.isError) return <ErrorNotice error={unit.error} />;
  const u = unit.data;

  return (
    <div className="stack">
      <nav aria-label="Brotkrumen" className="small">
        <Link to="/objekte">Objekte</Link> › <Link to={`/objekte/${u.propertyId}?ansicht=einheiten`}>Objekt</Link> › {u.number}
      </nav>
      <PageHeader title={`Einheit ${u.number}`} description={`${UNIT_TYPE[u.type]}${u.floor ? ` · ${u.floor}` : ""}${u.position ? `, ${u.position}` : ""}`} />
      <div className="grid grid-2">
        <Card title={`Flächen und Anteile ${asOf ? `zum ${formatDate(asOf)}` : "heute"}`}>
          <div className="stack">
            <TextField
              label="Stichtag"
              value={asOfInput}
              onChange={(v) => setParams(v ? { stichtag: v } : {}, { replace: true })}
              placeholder="TT.MM.JJJJ"
              description="Werte zu einem früheren Datum anzeigen, z. B. für eine alte Abrechnung"
              error={asOfInput && !asOf ? "Datum als TT.MM.JJJJ" : undefined}
            />
            <dl className="dl">
              {Object.keys(MEASURE).map((k) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{MEASURE[k]}</dt>
                  <dd className="num">{u.measures[k] ? formatDecimal(u.measures[k]) + (k.endsWith("area") ? " m²" : "") : "–"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
        {can("masterdata.write") && <RecordMeasure unitId={u.id} />}
      </div>
      <Card title="Historie (bitemporal)">
        <p className="small muted" style={{ marginTop: 0 }}>
          Jede Änderung bleibt erhalten. Ersetzte Einträge zeigen, was zu welchem Zeitpunkt bekannt war; so bleiben frühere Abrechnungen nachvollziehbar.
        </p>
        {history.isPending && <Spinner />}
        {history.data && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Wert</th>
                  <th scope="col" className="num">
                    Betrag
                  </th>
                  <th scope="col">Gültig</th>
                  <th scope="col">Erfasst</th>
                  <th scope="col">Stand</th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((h, i) => (
                  <tr key={`${h.measure}-${h.validFrom}-${h.recordedAt}-${i}`} style={h.supersededAt ? { color: "var(--ink-muted)" } : undefined}>
                    <td>{MEASURE[h.measure]}</td>
                    <td className="num">{formatDecimal(h.value)}</td>
                    <td className="num">
                      {formatDate(h.validFrom)} – {h.validTo ? formatDate(addDays(h.validTo, -1)) : "offen"}
                    </td>
                    <td className="num small">{formatDateTime(h.recordedAt)}</td>
                    <td>{h.supersededAt ? <Badge>ersetzt am {formatDateTime(h.supersededAt)}</Badge> : <Badge tone="accent">aktuell</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Dokumente der Einheit">
        <DocumentsPanel entityType="unit" entityId={u.id} propertyId={u.propertyId} />
      </Card>
      <Help>Rückwirkende Korrekturen: Tragen Sie den richtigen Wert mit dem Datum ein, ab dem er gilt. Spätere Werte bleiben bestehen, wenn Sie ein Ende angeben.</Help>
    </div>
  );
}

function RecordMeasure({ unitId }: { unitId: string }) {
  const [form, setForm] = useState({ measure: "living_area", value: "", validFrom: formatDate(isoToday()), validTo: "", source: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const from = parseGermanDate(form.validFrom);
  const to = form.validTo ? parseGermanDate(form.validTo) : null;
  const mutation = useApiMutation(() =>
    unwrap(
      api.POST("/v1/units/{id}/measures", {
        params: { path: { id: unitId } },
        body: {
          measure: form.measure as "living_area",
          value: toApiDecimal(form.value),
          validFrom: from!,
          validTo: to ? addDays(to, 1) : null,
          source: form.source || null,
        },
      }),
    ),
  );
  return (
    <Card title="Wert erfassen oder korrigieren">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(undefined, { onSuccess: () => setForm((f) => ({ ...f, value: "", source: "" })) });
        }}
      >
        <div className="form-grid">
          <SelectField label="Wert" options={measureOptions} value={form.measure} onChange={set("measure")} />
          <TextField label="Betrag" value={form.value} onChange={set("value")} inputMode="decimal" isRequired placeholder="62,50" />
        </div>
        <div className="form-grid">
          <TextField label="Gültig ab" value={form.validFrom} onChange={set("validFrom")} isRequired error={form.validFrom && !from ? "TT.MM.JJJJ" : undefined} />
          <TextField label="Gültig bis einschließlich" value={form.validTo} onChange={set("validTo")} description="leer = unbefristet" error={form.validTo && !to ? "TT.MM.JJJJ" : undefined} />
        </div>
        <TextField label="Quelle" value={form.source} onChange={set("source")} placeholder="z. B. Aufmaß 2026" />
        {mutation.isError && <ErrorNotice error={mutation.error} title="Wert nicht gespeichert" />}
        {mutation.isSuccess && <div className="status status-ok">Gespeichert</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" isDisabled={!form.value || !from || mutation.isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Card>
  );
}
