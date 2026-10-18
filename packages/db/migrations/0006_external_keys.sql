-- Schlüssel aus Altsystemen und Importdateien (V20): macht wiederholte Importe idempotent
-- (Parallelbetrieb bis zum Stichtag) und hält die Herkunft jedes Datensatzes fest.

CREATE TABLE external_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  source        text NOT NULL CHECK (length(source) BETWEEN 1 AND 60),
  entity_type   text NOT NULL CHECK (entity_type IN ('property', 'building', 'unit', 'person', 'technical_asset', 'meter')),
  external_key  text NOT NULL CHECK (length(external_key) BETWEEN 1 AND 200),
  entity_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, entity_type, external_key)
);
CREATE INDEX external_keys_entity_idx ON external_keys (tenant_id, entity_type, entity_id);

ALTER TABLE external_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_keys FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON external_keys TO hv_app;

CREATE POLICY external_keys_access ON external_keys FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR cardinality((SELECT app.staff_property_ids())) > 0))
  WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR cardinality((SELECT app.staff_property_ids())) > 0));

SELECT app.attach_audit('external_keys');
