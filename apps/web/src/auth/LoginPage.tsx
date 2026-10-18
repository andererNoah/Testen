import { useQuery } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api, unwrap } from "../api/client";
import { Button, ErrorNotice, Notice, Spinner } from "../ui/components";
import { usePageTitle } from "../layout/usePageTitle";
import { setToken } from "./session";

/** Development login (ADR-0009): pick a demo user. Phase 1 replaces it with OIDC (Magic Link, Passkey). */
export function LoginPage() {
  usePageTitle("Anmelden");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["devUsers"], queryFn: () => unwrap(api.GET("/v1/dev/users")) });

  async function login(email: string, tenantSlug: string) {
    setBusy(email);
    setError(null);
    try {
      const { token } = await unwrap(api.POST("/v1/dev/login", { body: { email, tenantSlug } }));
      setToken(token);
      const next = params.get("weiter");
      navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const byTenant = new Map<string, NonNullable<typeof users.data>["items"]>();
  for (const u of users.data?.items ?? []) byTenant.set(u.tenantName, [...(byTenant.get(u.tenantName) ?? []), u]);

  return (
    <main className="content" style={{ maxWidth: 760, margin: "0 auto", paddingTop: 48 }}>
      <div className="stack">
        <div className="brand" style={{ fontSize: "1.3rem", padding: 0 }}>
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <div>
            [PRODUKTNAME]
            <small>Plattform für Hausverwaltungen</small>
          </div>
        </div>
        <h1>Anmelden</h1>
        <Notice>
          Entwicklungs-Anmeldung: Wählen Sie einen Benutzer des Demo-Mandanten. Jede Rolle sieht nur ihre Objekte. Die echte Anmeldung mit Magic Link und Passkey
          folgt in Phase 1.
        </Notice>
        {users.isPending && <Spinner />}
        {users.isError && <ErrorNotice error={users.error} title="Benutzer konnten nicht geladen werden" />}
        {users.data?.items.length === 0 && (
          <Notice tone="warning">
            Noch keine Benutzer vorhanden. Legen Sie den Demo-Mandanten an: <code>pnpm db:seed</code>
          </Notice>
        )}
        {error ? <ErrorNotice error={error} title="Anmeldung fehlgeschlagen" /> : null}
        {[...byTenant.entries()].map(([tenant, list]) => (
          <section key={tenant} className="card" aria-labelledby={`t-${tenant}`}>
            <h2 id={`t-${tenant}`} className="card-title">
              {tenant}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
              {list!.map((u) => (
                <li key={u.email} className="spread">
                  <div>
                    <strong>{u.displayName}</strong>
                    <div className="small muted">
                      {u.roles.join(", ") || "ohne Rolle"} · {u.email}
                    </div>
                  </div>
                  <Button variant="primary" size="sm" onPress={() => login(u.email, u.tenantSlug)} isDisabled={busy !== null} aria-label={`Als ${u.displayName} anmelden`}>
                    <LogIn size={16} aria-hidden="true" />
                    Anmelden
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
