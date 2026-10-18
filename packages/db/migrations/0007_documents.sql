-- Dokumente (Phase 0, Grundfunktion): Versionen mit Prüfsumme, Verknüpfung mit beliebig vielen
-- Akten, Aufbewahrungsfrist. Der Inhalt liegt im Speicher-Adapter, nicht in der Datenbank.

CREATE TABLE documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants (id),
  title            text NOT NULL CHECK (length(trim(title)) > 0),
  category         text NOT NULL CHECK (category IN ('contract', 'protocol', 'invoice', 'statement', 'correspondence', 'technical', 'plan', 'certificate', 'photo', 'other')),
  document_date    date,
  current_version  integer NOT NULL DEFAULT 0,
  retention_until  date,
  retention_rule   text,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE TABLE document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  document_id  uuid NOT NULL,
  version      integer NOT NULL CHECK (version > 0),
  storage_key  text NOT NULL,
  filename     text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes >= 0),
  sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id),
  UNIQUE (document_id, version)
);

CREATE TABLE document_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  document_id  uuid NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('property', 'building', 'unit', 'person', 'technical_asset', 'meter')),
  entity_id    uuid NOT NULL,
  -- Objekt der Akte, für RLS; NULL bei Personenakten
  property_id  uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  UNIQUE (document_id, entity_type, entity_id)
);
CREATE INDEX document_links_entity_idx ON document_links (tenant_id, entity_type, entity_id);
CREATE INDEX document_links_property_idx ON document_links (property_id);

CREATE TRIGGER documents_touch BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_links FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON documents TO hv_app;
GRANT SELECT, INSERT ON document_versions TO hv_app;
GRANT SELECT, INSERT, DELETE ON document_links TO hv_app;

-- Verknüpfungen: sichtbar wie die Akte, an der sie hängen.
CREATE POLICY document_links_read ON document_links FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope())
    OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])
    OR (entity_type = 'unit' AND entity_id = ANY ((SELECT app.unit_scope_ids())::uuid[]))
    OR (entity_type = 'person' AND entity_id = (SELECT app.current_person_id()))));
CREATE POLICY document_links_write ON document_links FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))
  WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])));

-- Dokumente: sichtbar bei Mandantenbereich, als Ersteller oder über eine sichtbare Verknüpfung.
CREATE POLICY documents_read ON documents FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR created_by = app.current_user_id()
    OR EXISTS (SELECT 1 FROM document_links l WHERE l.document_id = documents.id)));
CREATE POLICY documents_insert ON documents FOR INSERT TO hv_app
  WITH CHECK (tenant_id = app.current_tenant_id() AND created_by = app.current_user_id()
    AND ((SELECT app.has_tenant_scope()) OR cardinality((SELECT app.staff_property_ids())) > 0));
CREATE POLICY documents_update ON documents FOR UPDATE TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR created_by = app.current_user_id()
    OR EXISTS (SELECT 1 FROM document_links l WHERE l.document_id = documents.id AND l.property_id = ANY ((SELECT app.staff_property_ids())::uuid[]))))
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY document_versions_read ON document_versions FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_versions.document_id));
CREATE POLICY document_versions_insert ON document_versions FOR INSERT TO hv_app
  WITH CHECK (tenant_id = app.current_tenant_id() AND created_by = app.current_user_id()
    AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_versions.document_id));

SELECT app.attach_audit(t) FROM unnest(ARRAY['documents', 'document_versions', 'document_links']) AS t;
