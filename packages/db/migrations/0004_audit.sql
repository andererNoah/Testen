-- Audit-Log (ADR-0007): jede Änderung per Trigger, nur anhängend.

CREATE TABLE audit_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid,
  occurred_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id   uuid,
  actor_kind      text NOT NULL CHECK (actor_kind IN ('user', 'system', 'import')),
  request_id      text,
  table_name      text NOT NULL,
  row_id          uuid,
  action          text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[],
  entry_hash      text
);
CREATE INDEX audit_log_tenant_time_idx ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX audit_log_row_idx ON audit_log (tenant_id, table_name, row_id);

CREATE TABLE access_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  occurred_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  user_id      uuid NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  action       text NOT NULL CHECK (action IN ('read', 'export')),
  request_id   text,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX access_log_entity_idx ON access_log (tenant_id, entity_type, entity_id, occurred_at DESC);

CREATE FUNCTION app.audit_trigger() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_tenant uuid;
  v_user uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_kind text := nullif(current_setting('app.actor_kind', true), '');
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  -- Trigger-Argumente = Spalten, die nicht ins Log kommen (z. B. große Rohdaten).
  IF TG_NARGS > 0 THEN
    v_old := v_old - TG_ARGV::text[];
    v_new := v_new - TG_ARGV::text[];
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
      FROM jsonb_each(v_new) n
     WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM v_old -> n.key;
    IF v_changed IS NULL THEN RETURN NULL; END IF;
  END IF;

  v_tenant := CASE WHEN TG_TABLE_NAME = 'tenants' THEN coalesce(v_new, v_old) ->> 'id'
                   ELSE coalesce(v_new, v_old) ->> 'tenant_id' END;

  INSERT INTO audit_log (tenant_id, actor_user_id, actor_kind, request_id, table_name, row_id, action, old_data, new_data, changed_fields)
  VALUES (v_tenant, v_user, coalesce(v_kind, CASE WHEN v_user IS NULL THEN 'system' ELSE 'user' END),
          nullif(current_setting('app.request_id', true), ''), TG_TABLE_NAME,
          (coalesce(v_new, v_old) ->> 'id')::uuid, lower(TG_OP), v_old, v_new, v_changed);
  RETURN NULL;
END $$;

CREATE FUNCTION app.audit_log_immutable() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Das Audit-Log ist unveränderlich (%).', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION app.audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION app.audit_log_immutable();
CREATE TRIGGER access_log_no_update BEFORE UPDATE OR DELETE ON access_log FOR EACH ROW EXECUTE FUNCTION app.audit_log_immutable();

-- Trigger an jede fachliche Tabelle hängen. Neue Tabellen: app.attach_audit('<name>') aufrufen.
CREATE FUNCTION app.attach_audit(p_table text, p_exclude text[] DEFAULT '{}') RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.audit_trigger(%s)',
                 p_table || '_audit', p_table,
                 coalesce((SELECT string_agg(quote_literal(x), ', ') FROM unnest(p_exclude) AS x), ''));
END $$;

SELECT app.attach_audit(t) FROM unnest(ARRAY['tenants', 'users', 'roles', 'role_assignments', 'properties', 'buildings', 'units',
  'unit_measures', 'technical_assets', 'meters', 'persons', 'person_roles', 'custom_field_definitions']) AS t;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_log FORCE ROW LEVEL SECURITY;

GRANT SELECT ON audit_log TO hv_app;
GRANT SELECT, INSERT ON access_log TO hv_app;

CREATE POLICY audit_read ON audit_log FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));
CREATE POLICY access_log_insert ON access_log FOR INSERT TO hv_app
  WITH CHECK (tenant_id = app.current_tenant_id() AND user_id = app.current_user_id());
CREATE POLICY access_log_read ON access_log FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

REVOKE ALL ON FUNCTION app.audit_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.attach_audit(text, text[]) FROM PUBLIC;
