# Datenmodell

Stand: Phase 0. Tabellen mit `tenant_id` haben RLS (ADR-0003) und den Audit-Trigger (ADR-0007). Zeiträume sind halboffen `[valid_from, valid_to)`; `valid_to = NULL` heißt „unbefristet“. Beträge sind `bigint` in Cent (ADR-0004).

## Überblick

```
tenants ─┬─ users ── role_assignments ──(Bereich: Mandant | Objekt | Einheit)
         │     └── (person_id) ─────────────┐
         ├─ roles (Vorlagen + eigene)        │
         ├─ properties (Verwaltungsobjekt) ─┼─ buildings ── units ── unit_measures (bitemporal)
         │        │                          │                  └── meters
         │        └── technical_assets       │
         ├─ persons ── person_roles ─────────┘ (Eigentümer, Mieter, Beirat, … am Objekt/an der Einheit)
         ├─ custom_field_definitions
         ├─ import_jobs
         ├─ documents ── document_versions, document_links (Akte = Verknüpfung zu Entität)
         ├─ audit_log (nur anhängend)
         └─ access_log (Lesezugriffe auf personenbezogene Daten)

global: legal_rules ── legal_rule_versions (Regelkatalog, kein Mandantenbezug)
```

## Organisation

| Tabelle | Zweck | Wichtige Spalten |
| --- | --- | --- |
| `tenants` | Mandant = eine Verwaltung | `name`, `slug`, `modules` (zugeschaltete Module, V21), `settings` |
| `users` | Login eines Menschen in einem Mandanten | `email`, `display_name`, `person_id` (Verknüpfung zur Person, z. B. Mieter im Portal), `status` |
| `roles` | Rollen je Mandant, aus Vorlagen erzeugt, anpassbar | `key`, `name`, `permissions text[]`, `is_system` |
| `role_assignments` | Wer hat welche Rolle wo | `user_id`, `role_id`, `scope_type` (`tenant`, `property`, `unit`), `scope_id`, `valid_from`, `valid_to` |

## Bestand

| Tabelle | Zweck | Wichtige Spalten |
| --- | --- | --- |
| `properties` | Verwaltungsobjekt: WEG, Mietobjekt, SEV-Bestand | `kind` (`weg`, `rental`, `sev`), `code` (Objektnummer), `name`, Adresse, `state` (Bundesland, steuert Landesrecht), `mea_denominator` (z. B. 10.000), `voting_principle` (`head`, `value`, `object`), `settlement_period_start_month`, `custom_fields` |
| `buildings` | Gebäude eines Objekts | `name`, Adresse, `year_built`, `usage` (`residential`, `non_residential`, `mixed`, für CO2-Aufteilung) |
| `units` | Einheit | `number` (z. B. „WE 03“), `type` (`apartment`, `commercial`, `parking`, `garage`, `ancillary`), `floor`, `position`, `linked_unit_id` (SEV-Einheit → WEG-Einheit), `custom_fields` |
| `unit_measures` | Flächen, Anteile, Personenzahl, **bitemporal** | `measure` (`living_area`, `usable_area`, `heated_area`, `mea`, `persons`), `value numeric(14,4)`, `valid_from`, `valid_to`, `recorded_at`, `superseded_at`, `source` |
| `technical_assets` | Anlagen und Technik | `kind` (`heating`, `drinking_water`, `elevator`, `smoke_detectors`, `energy_certificate`), `installed_on`, `energy_carrier`, `attributes jsonb` (z. B. Großanlage, gewerbliche Abgabe), `last_inspection_on` |
| `meters` | Zähler | `unit_id` oder Allgemeinzähler, `kind` (Wärme, Warmwasser, Kaltwasser, Strom, Gas, HKV), `serial_number`, `remote_readable`, `interoperable`, `calibration_valid_until` |

## Personen-CRM

| Tabelle | Zweck | Wichtige Spalten |
| --- | --- | --- |
| `persons` | Eine Person, viele Rollen | `kind` (`natural`, `legal`), Name bzw. Firma, `birth_date`, Kontaktkanäle, `communication_preference`, `phonetic_key` (Kölner Phonetik für Dublettenprüfung), `merged_into_id`, `custom_fields` |
| `person_roles` | Rolle einer Person an Objekt/Einheit | `role` (`eigentuemer`, `mieter`, `mitmieter`, `beirat`, `dienstleister`, `buerge`, `bevollmaechtigter`), `property_id`, `unit_id`, `valid_from`, `valid_to`, `share` (z. B. „1/2“ bei Miteigentum) |

Verträge (Mietvertrag, Eigentumsverhältnis mit Kaufvertrag, Verwaltervertrag) folgen in Phase 1 als eigene Tabellen. `person_roles` bleibt die CRM-Sicht.

## Querschnitt

| Tabelle | Zweck |
| --- | --- |
| `custom_field_definitions` | Eigene Felder je Entität (V18): `entity_type`, `key`, `label`, `field_type` (`text`, `number`, `date`, `boolean`, `select`), `required`, `options` |
| `import_jobs` | Import-Assistent: Dateien, Mapping, Validierungsbericht, Status (`analyzed`, `validated`, `committed`, `failed`) |
| `documents`, `document_versions`, `document_links` | Dokumente mit Versionen (SHA-256, Größe, MIME), Ablage über Speicher-Adapter, Verknüpfung mit beliebig vielen Akten |
| `audit_log` | Jede Änderung (Trigger). Nur anhängend. |
| `access_log` | Lesezugriffe auf personenbezogene Daten (API) |
| `legal_rules`, `legal_rule_versions` | Synchronisierter Regelkatalog (global) |

## Bitemporale Abfrage

```sql
-- Wohnfläche der Einheit zum 01.07.2024 nach heutigem Wissen
SELECT value FROM unit_measures
 WHERE unit_id = $1 AND measure = 'living_area'
   AND valid_from <= DATE '2024-07-01' AND (valid_to IS NULL OR valid_to > DATE '2024-07-01')
   AND superseded_at IS NULL;

-- dasselbe nach Wissensstand vom 15.01.2025
   AND recorded_at <= TIMESTAMPTZ '2025-01-15' AND (superseded_at IS NULL OR superseded_at > TIMESTAMPTZ '2025-01-15');
```

## Ausblick Phase 1

Mietverträge, Nachträge, Kautionen, Sollstellungen, Konten, Buchungsjournal (nur anhängend, Storno statt Löschung), Bankkonten und Umsätze, Rechnungen, Vorgänge, Ereignis-Outbox.
