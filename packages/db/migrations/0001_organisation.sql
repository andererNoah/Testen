-- Organisation: Mandanten, Benutzer, Rollen, Rollenzuweisungen.
-- Objekte gehören der Rolle hv_owner; die Anwendung verbindet sich als hv_app (ADR-0003).

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO hv_app;
GRANT USAGE ON SCHEMA public TO hv_app;

-- Kontext der laufenden Transaktion (gesetzt von withTenant()).
CREATE FUNCTION app.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) > 0),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  modules     text[] NOT NULL DEFAULT ARRAY['masterdata', 'documents', 'import']::text[],
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  email         citext NOT NULL,
  display_name  text NOT NULL,
  person_id     uuid,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, id)
);

CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  key          text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name         text NOT NULL,
  description  text,
  permissions  text[] NOT NULL DEFAULT '{}',
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE role_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  user_id     uuid NOT NULL,
  role_id     uuid NOT NULL,
  scope_type  text NOT NULL CHECK (scope_type IN ('tenant', 'property', 'unit')),
  scope_id    uuid,
  valid_from  date NOT NULL DEFAULT current_date,
  valid_to    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'tenant') = (scope_id IS NULL)),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id)
);
CREATE INDEX role_assignments_user_idx ON role_assignments (tenant_id, user_id);

CREATE TRIGGER tenants_touch BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER roles_touch BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER role_assignments_touch BEFORE UPDATE ON role_assignments FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
