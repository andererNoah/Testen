-- Stammdaten: Verwaltungsobjekte, Gebäude, Einheiten, Flächen/Anteile (bitemporal),
-- Anlagen, Zähler, Personen, Personenrollen, eigene Felder.
-- Fremdschlüssel enthalten tenant_id, damit keine mandantenübergreifenden Verweise entstehen.

CREATE TABLE properties (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                      uuid NOT NULL REFERENCES tenants (id),
  kind                           text NOT NULL CHECK (kind IN ('weg', 'rental', 'sev')),
  code                           text NOT NULL CHECK (length(trim(code)) > 0),
  name                           text NOT NULL CHECK (length(trim(name)) > 0),
  street                         text,
  house_number                   text,
  postal_code                    text CHECK (postal_code IS NULL OR postal_code ~ '^\d{5}$'),
  city                           text,
  state                          text CHECK (state IS NULL OR state IN ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH')),
  mea_denominator                integer CHECK (mea_denominator IS NULL OR mea_denominator > 0),
  voting_principle               text CHECK (voting_principle IS NULL OR voting_principle IN ('head', 'value', 'object')),
  settlement_period_start_month  smallint NOT NULL DEFAULT 1 CHECK (settlement_period_start_month BETWEEN 1 AND 12),
  custom_fields                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at                    timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE buildings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_id   uuid NOT NULL,
  name          text NOT NULL,
  street        text,
  house_number  text,
  postal_code   text CHECK (postal_code IS NULL OR postal_code ~ '^\d{5}$'),
  city          text,
  year_built    smallint CHECK (year_built IS NULL OR year_built BETWEEN 1000 AND 2100),
  usage         text NOT NULL DEFAULT 'residential' CHECK (usage IN ('residential', 'non_residential', 'mixed')),
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  UNIQUE (tenant_id, property_id, id),
  UNIQUE (property_id, name)
);

CREATE TABLE units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  property_id     uuid NOT NULL,
  building_id     uuid,
  number          text NOT NULL CHECK (length(trim(number)) > 0),
  type            text NOT NULL CHECK (type IN ('apartment', 'commercial', 'parking', 'garage', 'ancillary')),
  floor           text,
  position        text,
  description     text,
  linked_unit_id  uuid,
  custom_fields   jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id, building_id) REFERENCES buildings (tenant_id, property_id, id),
  UNIQUE (property_id, number),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, property_id, id)
);
ALTER TABLE units ADD FOREIGN KEY (tenant_id, linked_unit_id) REFERENCES units (tenant_id, id);

-- Bitemporal (ADR-0006): Gültigkeit [valid_from, valid_to) × Erfassung [recorded_at, superseded_at).
CREATE TABLE unit_measures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  property_id    uuid NOT NULL,
  unit_id        uuid NOT NULL,
  measure        text NOT NULL CHECK (measure IN ('living_area', 'usable_area', 'heated_area', 'mea', 'persons')),
  value          numeric(14, 4) NOT NULL CHECK (value >= 0),
  valid_from     date NOT NULL,
  valid_to       date,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  superseded_at  timestamptz,
  source         text,
  note           text,
  FOREIGN KEY (tenant_id, property_id, unit_id) REFERENCES units (tenant_id, property_id, id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (superseded_at IS NULL OR superseded_at >= recorded_at),
  CONSTRAINT unit_measures_no_overlap
    EXCLUDE USING gist (unit_id WITH =, measure WITH =, daterange(valid_from, valid_to, '[)') WITH &&) WHERE (superseded_at IS NULL)
);
CREATE INDEX unit_measures_lookup_idx ON unit_measures (unit_id, measure, valid_from);

CREATE TABLE technical_assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  property_id         uuid NOT NULL,
  building_id         uuid,
  kind                text NOT NULL CHECK (kind IN ('heating', 'drinking_water', 'elevator', 'smoke_detectors', 'energy_certificate', 'other')),
  name                text NOT NULL,
  installed_on        date,
  energy_carrier      text CHECK (energy_carrier IS NULL OR energy_carrier IN ('gas', 'oil', 'lpg', 'district_heating', 'heat_pump', 'biomass', 'electric', 'solar', 'other')),
  last_inspection_on  date,
  attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id, building_id) REFERENCES buildings (tenant_id, property_id, id)
);

CREATE TABLE meters (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,
  property_id              uuid NOT NULL,
  building_id              uuid,
  unit_id                  uuid,
  kind                     text NOT NULL CHECK (kind IN ('heat', 'hot_water', 'cold_water', 'gas', 'electricity', 'hcd')),
  serial_number            text NOT NULL,
  location                 text,
  remote_readable          boolean NOT NULL DEFAULT false,
  interoperable            boolean NOT NULL DEFAULT false,
  calibration_valid_until  date,
  installed_on             date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id, unit_id) REFERENCES units (tenant_id, property_id, id),
  FOREIGN KEY (tenant_id, property_id, building_id) REFERENCES buildings (tenant_id, property_id, id),
  UNIQUE (tenant_id, kind, serial_number)
);

CREATE TABLE persons (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants (id),
  kind                      text NOT NULL CHECK (kind IN ('natural', 'legal')),
  salutation                text,
  title                     text,
  first_name                text,
  last_name                 text,
  company_name              text,
  birth_date                date,
  email                     citext,
  phone                     text,
  mobile                    text,
  street                    text,
  house_number              text,
  postal_code               text,
  city                      text,
  country                   text NOT NULL DEFAULT 'DE' CHECK (country ~ '^[A-Z]{2}$'),
  communication_preference  text NOT NULL DEFAULT 'email' CHECK (communication_preference IN ('email', 'letter', 'portal')),
  iban                      text CHECK (iban IS NULL OR iban ~ '^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$'),
  phonetic_key              text,
  notes                     text,
  merged_into_id            uuid,
  custom_fields             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by                uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'natural' AND last_name IS NOT NULL) OR (kind = 'legal' AND company_name IS NOT NULL)),
  UNIQUE (tenant_id, id)
);
ALTER TABLE persons ADD FOREIGN KEY (tenant_id, merged_into_id) REFERENCES persons (tenant_id, id);
CREATE INDEX persons_phonetic_idx ON persons (tenant_id, phonetic_key);
CREATE INDEX persons_email_idx ON persons (tenant_id, email);
CREATE INDEX persons_name_trgm_idx ON persons USING gin ((lower(coalesce(last_name, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(company_name, ''))) gin_trgm_ops);

ALTER TABLE users ADD FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id);

CREATE TABLE person_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  person_id    uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('eigentuemer', 'mieter', 'mitmieter', 'beirat', 'dienstleister', 'buerge', 'bevollmaechtigter')),
  property_id  uuid NOT NULL,
  unit_id      uuid,
  valid_from   date,
  valid_to     date,
  share        text CHECK (share IS NULL OR share ~ '^\d+/\d+$'),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES persons (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id),
  FOREIGN KEY (tenant_id, property_id, unit_id) REFERENCES units (tenant_id, property_id, id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);
CREATE INDEX person_roles_person_idx ON person_roles (person_id);
CREATE INDEX person_roles_property_idx ON person_roles (property_id);

CREATE TABLE custom_field_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  entity_type  text NOT NULL CHECK (entity_type IN ('property', 'building', 'unit', 'person')),
  key          text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label        text NOT NULL,
  field_type   text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  required     boolean NOT NULL DEFAULT false,
  options      jsonb NOT NULL DEFAULT '[]'::jsonb,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, key)
);

CREATE TRIGGER properties_touch BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER buildings_touch BEFORE UPDATE ON buildings FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER units_touch BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER technical_assets_touch BEFORE UPDATE ON technical_assets FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER meters_touch BEFORE UPDATE ON meters FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER persons_touch BEFORE UPDATE ON persons FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER person_roles_touch BEFORE UPDATE ON person_roles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER custom_field_definitions_touch BEFORE UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
