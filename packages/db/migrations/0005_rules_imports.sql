-- Regelkatalog (global, aus packages/rules synchronisiert) und Import-Aufträge.

CREATE TABLE legal_rules (
  key          text PRIMARY KEY,
  title        text NOT NULL,
  area         text NOT NULL,
  description  text NOT NULL,
  synced_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_rule_versions (
  rule_key       text NOT NULL REFERENCES legal_rules (key) ON DELETE CASCADE,
  version        text NOT NULL,
  valid_from     date NOT NULL,
  valid_to       date,
  status         text NOT NULL CHECK (status IN ('in_kraft', 'beschlossen', 'entwurf', 'deaktiviert')),
  summary        text NOT NULL,
  params         jsonb NOT NULL,
  sources        jsonb NOT NULL,
  recht_pruefen  text[] NOT NULL DEFAULT '{}',
  changelog      text,
  PRIMARY KEY (rule_key, version)
);
GRANT SELECT ON legal_rules, legal_rule_versions TO hv_app;

CREATE TABLE import_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  created_by    uuid NOT NULL,
  status        text NOT NULL CHECK (status IN ('analyzed', 'validated', 'committed', 'failed')),
  source_files  jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapping       jsonb NOT NULL DEFAULT '{}'::jsonb,
  report        jsonb,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  committed_at  timestamptz
);
CREATE TRIGGER import_jobs_touch BEFORE UPDATE ON import_jobs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON import_jobs TO hv_app;
CREATE POLICY import_jobs_access ON import_jobs FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR created_by = app.current_user_id()))
  WITH CHECK (tenant_id = app.current_tenant_id() AND created_by = app.current_user_id());

-- Import-Aufträge tragen die Rohdaten; ins Audit-Log kommen nur Status und Zusammenfassung,
-- die eigentlichen Datensätze protokollieren die Trigger der Zieltabellen.
SELECT app.attach_audit('import_jobs', ARRAY['data', 'report', 'mapping']);
