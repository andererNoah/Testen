import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { type ApiRequestError, api, unwrap } from "../api/client";
import { useApiMutation, useCan, usePersons } from "../api/queries";
import { PERSON_ROLE } from "../lib/labels";
import { parseGermanDate } from "../lib/format";
import { usePageTitle } from "../layout/usePageTitle";
import { Button, EmptyState, ErrorNotice, ModalDialog, Notice, PageHeader, SearchField, SelectField, Spinner, TextField } from "../ui/components";

export function PersonsPage() {
  usePageTitle("Personen");
  const [params, setParams] = useSearchParams();
  const can = useCan();
  const q = params.get("q") ?? "";
  const persons = usePersons(q ? { q } : {});
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="stack">
      <PageHeader
        title="Personen"
        description="Eine Person, viele Rollen: Eigentümer, Mieter, Beirat, Dienstleister"
        actions={
          can("persons.write") && (
            <Button variant="primary" onPress={() => setParam("neu", "1")}>
              <Plus size={16} aria-hidden="true" />
              Person anlegen
            </Button>
          )
        }
      />
      <div style={{ maxWidth: 420 }}>
        <SearchField label="Personen durchsuchen" value={q} onChange={(v) => setParam("q", v || null)} placeholder="Name, Firma, E-Mail, Ort …" />
      </div>
      {persons.isPending && <Spinner />}
      {persons.isError && <ErrorNotice error={persons.error} />}
      {persons.data?.items.length === 0 && <EmptyState title="Keine Personen gefunden" />}
      {persons.data && persons.data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Personen</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Rollen</th>
                <th scope="col">Kontakt</th>
                <th scope="col">Ort</th>
              </tr>
            </thead>
            <tbody>
              {persons.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/personen/${p.id}`}>{p.displayName}</Link>
                  </td>
                  <td className="small">{[...new Set(p.roles.map((r) => PERSON_ROLE[r.role]))].join(", ") || "–"}</td>
                  <td className="small">{p.email ?? p.phone ?? "–"}</td>
                  <td>{p.city ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreatePersonDialog isOpen={params.get("neu") === "1"} onClose={() => setParam("neu", null)} />
    </div>
  );
}

function CreatePersonDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ kind: "natural", firstName: "", lastName: "", companyName: "", birthDate: "", email: "", phone: "", iban: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const birthDate = form.birthDate ? parseGermanDate(form.birthDate) : null;
  const mutation = useApiMutation((ignoreDuplicates: boolean) =>
    unwrap(
      api.POST("/v1/persons", {
        body: {
          kind: form.kind as "natural" | "legal",
          firstName: form.kind === "natural" ? form.firstName || null : null,
          lastName: form.kind === "natural" ? form.lastName || null : null,
          companyName: form.kind === "legal" ? form.companyName || null : null,
          birthDate,
          email: form.email || null,
          phone: form.phone || null,
          iban: form.iban || null,
          ignoreDuplicates,
        },
      }),
    ),
  );
  const error = mutation.error as ApiRequestError | null;
  const duplicates = error?.status === 409 ? (error.candidates ?? []) : [];
  const issue = (path: string) => error?.issues?.find((i) => i.path === path)?.message;
  const submit = (ignore: boolean, close: () => void) =>
    mutation.mutate(ignore, {
      onSuccess: (p) => {
        close();
        navigate(`/personen/${p.id}`);
      },
    });

  return (
    <ModalDialog isOpen={isOpen} onOpenChange={(v) => !v && onClose()} title="Person anlegen">
      {(close) => (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false, close);
          }}
        >
          <SelectField
            label="Art"
            options={[
              { id: "natural", label: "Natürliche Person" },
              { id: "legal", label: "Firma / juristische Person" },
            ]}
            value={form.kind}
            onChange={set("kind")}
          />
          {form.kind === "natural" ? (
            <div className="form-grid">
              <TextField label="Vorname" value={form.firstName} onChange={set("firstName")} autoFocus />
              <TextField label="Nachname" value={form.lastName} onChange={set("lastName")} isRequired error={issue("lastName")} />
              <TextField label="Geburtsdatum" value={form.birthDate} onChange={set("birthDate")} placeholder="TT.MM.JJJJ" error={form.birthDate && !birthDate ? "TT.MM.JJJJ" : undefined} />
            </div>
          ) : (
            <TextField label="Firma" value={form.companyName} onChange={set("companyName")} isRequired error={issue("lastName")} autoFocus />
          )}
          <div className="form-grid">
            <TextField label="E-Mail" type="email" value={form.email} onChange={set("email")} error={issue("email")} />
            <TextField label="Telefon" value={form.phone} onChange={set("phone")} />
          </div>
          <TextField label="IBAN" value={form.iban} onChange={set("iban")} error={issue("iban")} description="Wird mit Prüfziffer geprüft" />
          {duplicates.length > 0 ? (
            <Notice tone="warning">
              <strong>Diese Person gibt es vermutlich schon.</strong>
              <ul>
                {duplicates.map((d) => (
                  <li key={d.personId}>
                    <Link to={`/personen/${d.personId}`} onClick={close}>
                      {d.displayName}
                    </Link>{" "}
                    <span className="muted">– {d.reasons.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            mutation.isError && <ErrorNotice error={mutation.error} title="Person nicht angelegt" />
          )}
          <div className="dialog-actions">
            <Button onPress={close}>Abbrechen</Button>
            {duplicates.length > 0 && <Button onPress={() => submit(true, close)}>Trotzdem neu anlegen</Button>}
            <Button type="submit" variant="primary" isDisabled={mutation.isPending}>
              Anlegen
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
