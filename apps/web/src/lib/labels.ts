import type { Option } from "../ui/components";

const toOptions = (record: Record<string, string>): Option[] => Object.entries(record).map(([id, label]) => ({ id, label }));

export const PROPERTY_KIND: Record<string, string> = { weg: "WEG", rental: "Mietobjekt", sev: "SEV" };
export const PROPERTY_KIND_LONG: Record<string, string> = { weg: "Wohnungseigentümergemeinschaft", rental: "Mietverwaltung", sev: "Sondereigentumsverwaltung" };
export const UNIT_TYPE: Record<string, string> = { apartment: "Wohnung", commercial: "Gewerbe", parking: "Stellplatz", garage: "Garage", ancillary: "Nebenfläche" };
export const MEASURE: Record<string, string> = { living_area: "Wohnfläche", usable_area: "Nutzfläche", heated_area: "Heizfläche", mea: "Miteigentumsanteil", persons: "Personen" };
export const PERSON_ROLE: Record<string, string> = {
  eigentuemer: "Eigentümer",
  mieter: "Mieter",
  mitmieter: "Mitmieter",
  beirat: "Beirat",
  dienstleister: "Dienstleister",
  buerge: "Bürge",
  bevollmaechtigter: "Bevollmächtigter",
};
export const ASSET_KIND: Record<string, string> = {
  heating: "Heizung",
  drinking_water: "Trinkwasser",
  elevator: "Aufzug",
  smoke_detectors: "Rauchwarnmelder",
  energy_certificate: "Energieausweis",
  other: "Sonstiges",
};
export const ENERGY_CARRIER: Record<string, string> = {
  gas: "Gas",
  oil: "Öl",
  lpg: "Flüssiggas",
  district_heating: "Fernwärme",
  heat_pump: "Wärmepumpe",
  biomass: "Biomasse",
  electric: "Strom",
  solar: "Solar",
  other: "Sonstiges",
};
export const METER_KIND: Record<string, string> = { heat: "Wärme", hot_water: "Warmwasser", cold_water: "Kaltwasser", gas: "Gas", electricity: "Strom", hcd: "Heizkostenverteiler" };
export const DEADLINE_KIND: Record<string, string> = {
  operating_cost_statement: "Betriebskostenabrechnung",
  legionella_test: "Legionellenprüfung",
  smoke_detector_maintenance: "Rauchwarnmelder",
  meter_remote_retrofit: "Fernablesung",
  meter_interoperability: "Interoperabilität",
  meter_calibration: "Eichfrist",
};
export const DOCUMENT_CATEGORY: Record<string, string> = {
  contract: "Vertrag",
  protocol: "Protokoll",
  invoice: "Rechnung",
  statement: "Abrechnung",
  correspondence: "Schriftverkehr",
  technical: "Technik",
  plan: "Plan",
  certificate: "Nachweis",
  photo: "Foto",
  other: "Sonstiges",
};
export const RULE_STATUS: Record<string, string> = { in_kraft: "in Kraft", beschlossen: "beschlossen", entwurf: "Entwurf", deaktiviert: "deaktiviert" };
export const RULE_AREA: Record<string, string> = { miete: "Miete", weg: "WEG", heizkosten: "Heizkosten & CO2", technik: "Technik & Prüfpflichten", steuer: "Steuer & GoBD", datenschutz: "Datenschutz & KI" };
export const AUDIT_ACTION: Record<string, string> = { insert: "angelegt", update: "geändert", delete: "gelöscht" };
export const AUDIT_TABLE: Record<string, string> = {
  properties: "Objekt",
  buildings: "Gebäude",
  units: "Einheit",
  unit_measures: "Fläche/Anteil",
  technical_assets: "Anlage",
  meters: "Zähler",
  persons: "Person",
  person_roles: "Personenrolle",
  users: "Benutzer",
  roles: "Rolle",
  role_assignments: "Rollenzuweisung",
  tenants: "Mandant",
  custom_field_definitions: "Eigenes Feld",
  import_jobs: "Import",
  external_keys: "Fremdschlüssel",
  documents: "Dokument",
  document_versions: "Dokumentversion",
  document_links: "Aktenverknüpfung",
};

export const propertyKindOptions = toOptions(PROPERTY_KIND_LONG);
export const unitTypeOptions = toOptions(UNIT_TYPE);
export const measureOptions = toOptions(MEASURE);
export const personRoleOptions = toOptions(PERSON_ROLE);
export const documentCategoryOptions = toOptions(DOCUMENT_CATEGORY);
export const STATES: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};
export const stateOptions = toOptions(STATES);
