import { Plus } from "lucide-react";
import { useState } from "react";
import { api, unwrap } from "../api/client";
import { useApiMutation, useCustomFields } from "../api/queries";
import { usePageTitle } from "../layout/usePageTitle";
import { Button, Card, EmptyState, ErrorNotice, PageHeader, SelectField, Spinner, TextField } from "../ui/components";

const ENTITY: Record<string, string> = { property: "Objekt", building: "Gebäude", unit: "Einheit", person: "Person" };
const TYPE: Record<string, string> = { text: "Text", number: "Zahl", date: "Datum", boolean: "Ja/Nein", select: "Auswahl" };

/** Eigene Felder (V18): adapt the system without programming. */
export function SettingsPage() {
  usePageTitle("Einstellungen");
  const fields = useCustomFields();
  const [form, setForm] = useState({ entityType: "property", key: "", label: "", fieldType: "text", options: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const mutation = useApiMutation(() =>
    unwrap(
      api.POST("/v1/custom-fields", {
        body: {
          entityType: form.entityType as "property",
          key: form.key,
          label: form.label,
          fieldType: form.fieldType as "text",
          options: form.fieldType === "select" ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
        },
      }),
    ),
  );
  const issue = (path: string) => (mutation.error as { issues?: Array<{ path: string; message: string }> } | null)?.issues?.find((i) => i.path === path)?.message;

  return (
    <div className="stack">
      <PageHeader title="Einstellungen" description="Eigene Felder für Objekte, Gebäude, Einheiten und Personen – nutzbar in Listen, Import und Berichten." />
      <Card title="Eigene Felder">
        {fields.isPending && <Spinner />}
        {fields.data?.items.length === 0 && <EmptyState title="Noch keine eigenen Felder" />}
        {fields.data && fields.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Bezeichnung</th>
                  <th scope="col">Schlüssel</th>
                  <th scope="col">Für</th>
                  <th scope="col">Typ</th>
                </tr>
              </thead>
              <tbody>
                {fields.data.items.map((f) => (
                  <tr key={f.id}>
                    <td>{f.label}</td>
                    <td>
                      <code>{f.key}</code>
                    </td>
                    <td>{ENTITY[f.entityType]}</td>
                    <td>
                      {TYPE[f.fieldType]}
                      {f.options.length > 0 && <span className="muted small"> ({f.options.join(", ")})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Neues Feld">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(undefined, { onSuccess: () => setForm((f) => ({ ...f, key: "", label: "", options: "" })) });
          }}
        >
          <div className="form-grid">
            <SelectField label="Für" options={Object.entries(ENTITY).map(([id, label]) => ({ id, label }))} value={form.entityType} onChange={set("entityType")} />
            <TextField label="Bezeichnung" value={form.label} onChange={set("label")} isRequired error={issue("label")} />
            <TextField label="Schlüssel" value={form.key} onChange={set("key")} isRequired description="Kleinbuchstaben, z. B. hausmeister" error={issue("key")} />
            <SelectField label="Typ" options={Object.entries(TYPE).map(([id, label]) => ({ id, label }))} value={form.fieldType} onChange={set("fieldType")} />
          </div>
          {form.fieldType === "select" && <TextField label="Optionen" value={form.options} onChange={set("options")} description="Kommagetrennt" error={issue("options")} />}
          {mutation.isError && <ErrorNotice error={mutation.error} title="Feld nicht angelegt" />}
          <div>
            <Button type="submit" variant="primary" isDisabled={!form.key || !form.label || mutation.isPending}>
              <Plus size={16} aria-hidden="true" />
              Feld anlegen
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
