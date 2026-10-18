import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, unwrap } from "../api/client";
import { useApiMutation, useCan, useProperties } from "../api/queries";
import { PROPERTY_KIND, PROPERTY_KIND_LONG, STATES, propertyKindOptions, stateOptions } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Button, EmptyState, ErrorNotice, Help, ModalDialog, PageHeader, SearchField, SelectField, Spinner, TextField } from "../ui/components";

export function PropertiesPage() {
  usePageTitle("Objekte");
  const [params, setParams] = useSearchParams();
  const can = useCan();
  const q = params.get("q") ?? "";
  const kind = (params.get("art") ?? "") as "" | "weg" | "rental" | "sev";
  const properties = useProperties({ ...(q ? { q } : {}), ...(kind ? { kind } : {}) });
  const createOpen = params.get("neu") === "1";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="stack">
      <PageHeader
        title="Objekte"
        description="WEG, Mietobjekte und Sondereigentumsverwaltung"
        actions={
          can("tenant.admin") && (
            <Button variant="primary" onPress={() => setParam("neu", "1")}>
              <Plus size={16} aria-hidden="true" />
              Objekt anlegen
            </Button>
          )
        }
      />
      <div className="row">
        <div style={{ flex: "1 1 280px", maxWidth: 420 }}>
          <SearchField label="Objekte durchsuchen" value={q} onChange={(v) => setParam("q", v || null)} placeholder="Nummer, Name, Ort …" />
        </div>
        <div className="row" role="group" aria-label="Art filtern">
          {(["", "weg", "rental", "sev"] as const).map((k) => (
            <Button key={k || "alle"} size="sm" variant={kind === k ? "primary" : "secondary"} onPress={() => setParam("art", k || null)} aria-pressed={kind === k}>
              {k ? PROPERTY_KIND[k] : "Alle"}
            </Button>
          ))}
        </div>
      </div>
      {properties.isPending && <Spinner />}
      {properties.isError && <ErrorNotice error={properties.error} />}
      {properties.data && properties.data.items.length === 0 && <EmptyState title="Keine Objekte gefunden">Passen Sie die Suche an oder importieren Sie Ihren Bestand.</EmptyState>}
      {properties.data && properties.data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Objekte</caption>
            <thead>
              <tr>
                <th scope="col">Nr.</th>
                <th scope="col">Name</th>
                <th scope="col">Art</th>
                <th scope="col">Anschrift</th>
                <th scope="col">Bundesland</th>
              </tr>
            </thead>
            <tbody>
              {properties.data.items.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.code}</td>
                  <td>
                    <Link to={`/objekte/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>
                    <Badge tone="accent">{PROPERTY_KIND[p.kind]}</Badge>
                  </td>
                  <td>{[p.street && `${p.street} ${p.houseNumber ?? ""}`.trim(), [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}</td>
                  <td>{p.state ? STATES[p.state] : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Help>
        Objekte legen Mandanten-Admins an; Objektbetreuer sehen nur die ihnen zugewiesenen Objekte. Für viele Objekte auf einmal nutzen Sie den Import.
      </Help>
      <CreatePropertyDialog isOpen={createOpen} onClose={() => setParam("neu", null)} />
    </div>
  );
}

function CreatePropertyDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ kind: "weg", code: "", name: "", street: "", houseNumber: "", postalCode: "", city: "", state: "", meaDenominator: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const mutation = useApiMutation(() =>
    unwrap(
      api.POST("/v1/properties", {
        body: {
          kind: form.kind as "weg" | "rental" | "sev",
          code: form.code,
          name: form.name,
          street: form.street || null,
          houseNumber: form.houseNumber || null,
          postalCode: form.postalCode || null,
          city: form.city || null,
          state: (form.state || null) as never,
          meaDenominator: form.kind !== "rental" && form.meaDenominator ? Number(form.meaDenominator) : null,
        },
      }),
    ),
  );
  const issue = (path: string) => (mutation.error as { issues?: Array<{ path: string; message: string }> } | null)?.issues?.find((i) => i.path === path)?.message;

  return (
    <ModalDialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} title="Objekt anlegen">
      {(close) => (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(undefined, {
              onSuccess: (p) => {
                close();
                navigate(`/objekte/${p.id}`);
              },
            });
          }}
        >
          <div className="form-grid">
            <SelectField label="Art" options={propertyKindOptions} value={form.kind} onChange={set("kind")} isRequired description={PROPERTY_KIND_LONG[form.kind]} />
            <TextField label="Objektnummer" value={form.code} onChange={set("code")} isRequired error={issue("code")} autoFocus />
          </div>
          <TextField label="Name" value={form.name} onChange={set("name")} isRequired error={issue("name")} placeholder="z. B. WEG Lindenstraße 12" />
          <div className="form-grid">
            <TextField label="Straße" value={form.street} onChange={set("street")} />
            <TextField label="Hausnummer" value={form.houseNumber} onChange={set("houseNumber")} />
            <TextField label="PLZ" value={form.postalCode} onChange={set("postalCode")} error={issue("postalCode")} inputMode="numeric" />
            <TextField label="Ort" value={form.city} onChange={set("city")} />
          </div>
          <div className="form-grid">
            <SelectField label="Bundesland" options={stateOptions} value={form.state || null} onChange={set("state")} description="Steuert Landesrecht und Feiertage" />
            {form.kind !== "rental" && (
              <TextField label="MEA-Nenner" value={form.meaDenominator} onChange={set("meaDenominator")} inputMode="numeric" description="z. B. 1000 oder 10000" error={issue("meaDenominator")} />
            )}
          </div>
          {mutation.isError && <ErrorNotice error={mutation.error} title="Objekt konnte nicht angelegt werden" />}
          <div className="dialog-actions">
            <Button onPress={close}>Abbrechen</Button>
            <Button type="submit" variant="primary" isDisabled={mutation.isPending}>
              Anlegen
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
