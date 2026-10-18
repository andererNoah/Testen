-- Row-Level-Security (ADR-0003): Mandantentrennung und objektgenaue Sichtbarkeit.
-- Die Hilfsfunktionen sind SECURITY DEFINER (Eigentümer hv_owner umgeht RLS), damit sie
-- Rollenzuweisungen ohne Rekursion durch Policies lesen können. In Policies werden sie als
-- (SELECT app.fn()) aufgerufen, damit PostgreSQL sie je Abfrage nur einmal auswertet.

CREATE FUNCTION app.active_assignments()
  RETURNS TABLE (scope_type text, scope_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ra.scope_type, ra.scope_id
    FROM role_assignments ra
    JOIN users u ON u.id = ra.user_id AND u.tenant_id = ra.tenant_id AND u.status = 'active'
   WHERE ra.tenant_id = app.current_tenant_id()
     AND ra.user_id = app.current_user_id()
     AND ra.valid_from <= current_date
     AND (ra.valid_to IS NULL OR ra.valid_to > current_date)
$$;

-- Zuweisung auf den ganzen Mandanten
CREATE FUNCTION app.has_tenant_scope() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM app.active_assignments() a WHERE a.scope_type = 'tenant')
$$;

-- Objekte mit Zuweisung auf Objektebene (Verwaltungspersonal, Beirat)
CREATE FUNCTION app.staff_property_ids() RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT a.scope_id), '{}') FROM app.active_assignments() a WHERE a.scope_type = 'property'
$$;

-- Einheiten mit Zuweisung auf Einheitsebene (Eigentümer, Mieter)
CREATE FUNCTION app.unit_scope_ids() RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT a.scope_id), '{}') FROM app.active_assignments() a WHERE a.scope_type = 'unit'
$$;

CREATE FUNCTION app.unit_scope_property_ids() RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT u.property_id), '{}')
    FROM app.active_assignments() a
    JOIN units u ON u.id = a.scope_id AND u.tenant_id = app.current_tenant_id()
   WHERE a.scope_type = 'unit'
$$;

CREATE FUNCTION app.current_person_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.person_id FROM users u WHERE u.id = app.current_user_id() AND u.tenant_id = app.current_tenant_id()
$$;

-- Rollenzuweisungen müssen auf ein Objekt/eine Einheit desselben Mandanten zeigen.
CREATE FUNCTION app.check_assignment_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.scope_type = 'property' AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = NEW.scope_id AND p.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Rollenzuweisung: Objekt % gehört nicht zum Mandanten', NEW.scope_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.scope_type = 'unit' AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = NEW.scope_id AND u.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Rollenzuweisung: Einheit % gehört nicht zum Mandanten', NEW.scope_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER role_assignments_scope BEFORE INSERT OR UPDATE ON role_assignments FOR EACH ROW EXECUTE FUNCTION app.check_assignment_scope();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO hv_app;

-- Rechte der Anwendungsrolle
GRANT SELECT, UPDATE ON tenants TO hv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, roles, role_assignments, properties, buildings, units, unit_measures,
  technical_assets, meters, persons, person_roles, custom_field_definitions TO hv_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants', 'users', 'roles', 'role_assignments', 'properties', 'buildings', 'units', 'unit_measures',
    'technical_assets', 'meters', 'persons', 'person_roles', 'custom_field_definitions']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Mandant
CREATE POLICY tenant_read ON tenants FOR SELECT TO hv_app USING (id = app.current_tenant_id());
CREATE POLICY tenant_update ON tenants FOR UPDATE TO hv_app
  USING (id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()))
  WITH CHECK (id = app.current_tenant_id());

-- Benutzer, Rollen, Zuweisungen
CREATE POLICY users_read ON users FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR id = app.current_user_id()));
CREATE POLICY users_write ON users FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()))
  WITH CHECK (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

CREATE POLICY roles_read ON roles FOR SELECT TO hv_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY roles_write ON roles FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()))
  WITH CHECK (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

CREATE POLICY role_assignments_read ON role_assignments FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR user_id = app.current_user_id()));
CREATE POLICY role_assignments_write ON role_assignments FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()))
  WITH CHECK (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

-- Verwaltungsobjekte
CREATE POLICY properties_read ON properties FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR id = ANY ((SELECT app.staff_property_ids())::uuid[]) OR id = ANY ((SELECT app.unit_scope_property_ids())::uuid[])));
CREATE POLICY properties_insert ON properties FOR INSERT TO hv_app
  WITH CHECK (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));
CREATE POLICY properties_update ON properties FOR UPDATE TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR id = ANY ((SELECT app.staff_property_ids())::uuid[])))
  WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR id = ANY ((SELECT app.staff_property_ids())::uuid[])));
CREATE POLICY properties_delete ON properties FOR DELETE TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

-- Objektgebundene Tabellen: lesen bei Zuweisung auf Mandant/Objekt (oder Einheit im Objekt),
-- schreiben nur bei Zuweisung auf Mandant/Objekt.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['buildings', 'technical_assets']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_read ON %1$I FOR SELECT TO hv_app
        USING (tenant_id = app.current_tenant_id() AND (
          (SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])
          OR property_id = ANY ((SELECT app.unit_scope_property_ids())::uuid[])))$f$, t);
    EXECUTE format($f$
      CREATE POLICY %1$s_write ON %1$I FOR ALL TO hv_app
        USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))
        WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))$f$, t);
  END LOOP;
END $$;

-- Einheitsgebundene Tabellen: Einheitszuweisung sieht nur die eigene Einheit.
CREATE POLICY units_read ON units FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[]) OR id = ANY ((SELECT app.unit_scope_ids())::uuid[])));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['unit_measures', 'meters']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_read ON %1$I FOR SELECT TO hv_app
        USING (tenant_id = app.current_tenant_id() AND (
          (SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])
          OR unit_id = ANY ((SELECT app.unit_scope_ids())::uuid[])))$f$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['units', 'unit_measures', 'meters']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_write ON %1$I FOR ALL TO hv_app
        USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))
        WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))$f$, t);
  END LOOP;
END $$;

-- Personenrollen
CREATE POLICY person_roles_read ON person_roles FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[]) OR person_id = (SELECT app.current_person_id())));
CREATE POLICY person_roles_write ON person_roles FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])))
  WITH CHECK (tenant_id = app.current_tenant_id() AND ((SELECT app.has_tenant_scope()) OR property_id = ANY ((SELECT app.staff_property_ids())::uuid[])));

-- Personen: sichtbar bei Mandantenzuweisung, als eigene Person, als selbst angelegte Person
-- oder wenn die Person eine Rolle in einem Objekt hat, für das der Benutzer Objektzuweisung hat.
CREATE POLICY persons_read ON persons FOR SELECT TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope())
    OR id = (SELECT app.current_person_id())
    OR created_by = app.current_user_id()
    OR EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = persons.id AND pr.property_id = ANY ((SELECT app.staff_property_ids())::uuid[]))));
CREATE POLICY persons_insert ON persons FOR INSERT TO hv_app
  WITH CHECK (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR cardinality((SELECT app.staff_property_ids())) > 0));
CREATE POLICY persons_update ON persons FOR UPDATE TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (
    (SELECT app.has_tenant_scope()) OR created_by = app.current_user_id()
    OR EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = persons.id AND pr.property_id = ANY ((SELECT app.staff_property_ids())::uuid[]))))
  WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY persons_delete ON persons FOR DELETE TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));

-- Eigene Felder
CREATE POLICY custom_fields_read ON custom_field_definitions FOR SELECT TO hv_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY custom_fields_write ON custom_field_definitions FOR ALL TO hv_app
  USING (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()))
  WITH CHECK (tenant_id = app.current_tenant_id() AND (SELECT app.has_tenant_scope()));
