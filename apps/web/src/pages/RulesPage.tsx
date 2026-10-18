import { ExternalLink } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { useSearchParams } from "react-router";
import { useChangelog, useRules } from "../api/queries";
import { formatDate, parseGermanDate } from "../lib/format";
import { RULE_AREA, RULE_STATUS } from "../lib/labels";
import { usePageTitle } from "../layout/usePageTitle";
import { Badge, Card, ErrorNotice, PageHeader, Spinner, TextField } from "../ui/components";

export function RulesPage() {
  usePageTitle("Regeln & Recht");
  const [params, setParams] = useSearchParams();
  const asOfInput = params.get("stichtag") ?? "";
  const asOf = asOfInput ? (parseGermanDate(asOfInput) ?? undefined) : undefined;
  const rules = useRules(asOf);
  const changelog = useChangelog();
  const tab = params.get("ansicht") === "changelog" ? "changelog" : "katalog";
  const areas = [...new Set(rules.data?.items.map((r) => r.area) ?? [])];

  return (
    <div className="stack">
      <PageHeader title="Regeln & Recht" description="Recht als versionierte Regel: jede Frist, jeder Schlüssel und jede Kappung mit Gültigkeit und Quelle." />
      <Tabs className="tabs" selectedKey={tab} onSelectionChange={(k) => setParams(k === "changelog" ? { ansicht: "changelog" } : {})}>
        <TabList aria-label="Ansicht">
          <Tab id="katalog" className="tab">
            Regelkatalog
          </Tab>
          <Tab id="changelog" className="tab">
            Rechtsänderungen
          </Tab>
        </TabList>
        <TabPanel id="katalog">
          <div className="stack">
            <div style={{ maxWidth: 280 }}>
              <TextField
                label="Stichtag"
                value={asOfInput}
                onChange={(v) => setParams(v ? { stichtag: v } : {}, { replace: true })}
                placeholder="heute"
                description="z. B. 01.01.2029 für künftiges Recht"
                error={asOfInput && !asOf ? "TT.MM.JJJJ" : undefined}
              />
            </div>
            {rules.isPending && <Spinner />}
            {rules.isError && <ErrorNotice error={rules.error} />}
            {areas.map((area) => (
              <Card key={area} title={RULE_AREA[area] ?? area}>
                <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {rules.data!.items
                    .filter((r) => r.area === area)
                    .map((r) => (
                      <li key={r.key}>
                        <div className="spread">
                          <strong>{r.title}</strong>
                          {r.current ? (
                            <Badge tone="accent">
                              {RULE_STATUS[r.current.status]} · seit {formatDate(r.current.validFrom)}
                            </Badge>
                          ) : (
                            <Badge>{r.versions.some((v) => v.status === "entwurf") ? "Entwurf – nicht angewendet" : "zum Stichtag nicht gültig"}</Badge>
                          )}
                        </div>
                        <div className="small" style={{ marginTop: 4 }}>
                          {(r.current ?? r.versions[r.versions.length - 1])?.summary}
                        </div>
                        <div className="row small" style={{ gap: 8, marginTop: 4 }}>
                          <code className="muted">{r.key}</code>
                          {(r.current ?? r.versions[0])?.sources.map((s) =>
                            s.url ? (
                              <a key={s.label} href={s.url} target="_blank" rel="noreferrer">
                                {s.norm ?? s.label} <ExternalLink size={12} aria-hidden="true" />
                                <span className="visually-hidden"> (öffnet neues Fenster)</span>
                              </a>
                            ) : (
                              <span key={s.label}>{s.label}</span>
                            ),
                          )}
                          {(r.current ?? r.versions[0])?.rechtPruefen.map((id) => (
                            <Badge key={id}>RECHT-PRÜFEN {id}</Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        </TabPanel>
        <TabPanel id="changelog">
          {changelog.isPending && <Spinner />}
          {changelog.data && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Gilt ab</th>
                    <th scope="col">Regel</th>
                    <th scope="col">Änderung</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {changelog.data.items.map((c) => (
                    <tr key={`${c.key}@${c.version}`}>
                      <td className="num">{formatDate(c.validFrom)}</td>
                      <td>{c.title}</td>
                      <td>{c.text}</td>
                      <td>{RULE_STATUS[c.status] ?? c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
