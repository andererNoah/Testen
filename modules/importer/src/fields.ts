/**
 * Import template (docs/import-vorlage.md): one sheet or CSV file per entity.
 * Labels are the template headers; synonyms help map exports from other systems (V20).
 */

export type EntityKey = "properties" | "buildings" | "units" | "persons" | "roles" | "assets" | "meters";

export type FieldType = "text" | "integer" | "decimal" | "date" | "boolean" | "enum" | "postalCode" | "email" | "iban";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  synonyms?: string[];
  /** For enum fields: accepted spellings → code. */
  values?: Record<string, string>;
  hint?: string;
}

export interface EntityDef {
  key: EntityKey;
  label: string;
  /** Sheet/file names that identify this entity. */
  names: string[];
  fields: FieldDef[];
  /** Order of application (references point to earlier entities). */
  order: number;
}

const STATES: Record<string, string> = {
  "baden-württemberg": "BW", "baden-wuerttemberg": "BW", bw: "BW",
  bayern: "BY", by: "BY",
  berlin: "BE", be: "BE",
  brandenburg: "BB", bb: "BB",
  bremen: "HB", hb: "HB",
  hamburg: "HH", hh: "HH",
  hessen: "HE", he: "HE",
  "mecklenburg-vorpommern": "MV", mv: "MV",
  niedersachsen: "NI", ni: "NI",
  "nordrhein-westfalen": "NW", nrw: "NW", nw: "NW",
  "rheinland-pfalz": "RP", rp: "RP",
  saarland: "SL", sl: "SL",
  sachsen: "SN", sn: "SN",
  "sachsen-anhalt": "ST", st: "ST",
  "schleswig-holstein": "SH", sh: "SH",
  thüringen: "TH", thueringen: "TH", th: "TH",
};

const PROPERTY_KINDS = { weg: "weg", "wohnungseigentümergemeinschaft": "weg", "wohnungseigentuemergemeinschaft": "weg", miete: "rental", mietverwaltung: "rental", mietobjekt: "rental", mietshaus: "rental", zinshaus: "rental", rental: "rental", sev: "sev", sondereigentumsverwaltung: "sev", sondereigentum: "sev" };
const UNIT_TYPES = { wohnung: "apartment", we: "apartment", whg: "apartment", apartment: "apartment", gewerbe: "commercial", ge: "commercial", laden: "commercial", büro: "commercial", buero: "commercial", praxis: "commercial", commercial: "commercial", stellplatz: "parking", sp: "parking", tg: "parking", tiefgaragenstellplatz: "parking", parking: "parking", garage: "garage", ga: "garage", nebenfläche: "ancillary", nebenflaeche: "ancillary", keller: "ancillary", lager: "ancillary", abstellraum: "ancillary", ancillary: "ancillary" };
const ROLES = { eigentümer: "eigentuemer", eigentuemer: "eigentuemer", eigentümerin: "eigentuemer", et: "eigentuemer", mieter: "mieter", mieterin: "mieter", mitmieter: "mitmieter", mitmieterin: "mitmieter", beirat: "beirat", verwaltungsbeirat: "beirat", dienstleister: "dienstleister", handwerker: "dienstleister", bürge: "buerge", buerge: "buerge", bevollmächtigter: "bevollmaechtigter", bevollmaechtigter: "bevollmaechtigter", vertreter: "bevollmaechtigter" };
const ASSET_KINDS = { heizung: "heating", heizungsanlage: "heating", kessel: "heating", trinkwasser: "drinking_water", trinkwasseranlage: "drinking_water", warmwasser: "drinking_water", "warmwasserspeicher": "drinking_water", aufzug: "elevator", fahrstuhl: "elevator", lift: "elevator", rauchwarnmelder: "smoke_detectors", rwm: "smoke_detectors", rauchmelder: "smoke_detectors", energieausweis: "energy_certificate", sonstige: "other", sonstiges: "other" };
const CARRIERS = { gas: "gas", erdgas: "gas", öl: "oil", oel: "oil", heizöl: "oil", heizoel: "oil", flüssiggas: "lpg", fluessiggas: "lpg", lpg: "lpg", fernwärme: "district_heating", fernwaerme: "district_heating", wärmepumpe: "heat_pump", waermepumpe: "heat_pump", holz: "biomass", pellets: "biomass", biomasse: "biomass", strom: "electric", solar: "solar", solarthermie: "solar", sonstige: "other" };
const METER_KINDS = { wärme: "heat", waerme: "heat", wärmezähler: "heat", waermezaehler: "heat", wmz: "heat", warmwasser: "hot_water", warmwasserzähler: "hot_water", wwz: "hot_water", kaltwasser: "cold_water", kaltwasserzähler: "cold_water", kwz: "cold_water", wasser: "cold_water", gas: "gas", gaszähler: "gas", strom: "electricity", stromzähler: "electricity", hkv: "hcd", heizkostenverteiler: "hcd" };
const PERSON_KINDS = { natürlich: "natural", natuerlich: "natural", "natürliche person": "natural", person: "natural", privat: "natural", juristisch: "legal", "juristische person": "legal", firma: "legal", unternehmen: "legal" };
const CHANNELS = { "e-mail": "email", email: "email", mail: "email", brief: "letter", post: "letter", portal: "portal", app: "portal" };
const USAGES = { wohnen: "residential", wohngebäude: "residential", wohngebaeude: "residential", gewerbe: "non_residential", nichtwohngebäude: "non_residential", nichtwohngebaeude: "non_residential", gemischt: "mixed", mischnutzung: "mixed" };
const VOTING = { kopf: "head", kopfprinzip: "head", wert: "value", wertprinzip: "value", objekt: "object", objektprinzip: "object" };

export const ENTITIES: Record<EntityKey, EntityDef> = {
  properties: {
    key: "properties",
    label: "Objekte",
    names: ["objekte", "objekt", "liegenschaften", "verwaltungsobjekte", "properties"],
    order: 1,
    fields: [
      { key: "code", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "objekt nr", "obj-nr", "obj nr", "liegenschaftsnummer", "nr"] },
      { key: "kind", label: "Art", type: "enum", required: true, values: PROPERTY_KINDS, synonyms: ["verwaltungsart", "objektart", "typ"], hint: "WEG, Miete oder SEV" },
      { key: "name", label: "Name", type: "text", required: true, synonyms: ["bezeichnung", "objektname", "objektbezeichnung"] },
      { key: "street", label: "Straße", type: "text", synonyms: ["strasse", "str"] },
      { key: "houseNumber", label: "Hausnummer", type: "text", synonyms: ["hausnr", "hnr", "nr."] },
      { key: "postalCode", label: "PLZ", type: "postalCode", synonyms: ["postleitzahl"] },
      { key: "city", label: "Ort", type: "text", synonyms: ["stadt", "gemeinde"] },
      { key: "state", label: "Bundesland", type: "enum", values: STATES, synonyms: ["land"] },
      { key: "meaDenominator", label: "MEA-Nenner", type: "integer", synonyms: ["mea nenner", "nenner", "miteigentumsanteile gesamt", "mea gesamt"] },
      { key: "votingPrinciple", label: "Stimmrecht", type: "enum", values: VOTING, synonyms: ["stimmrechtsprinzip"] },
      { key: "settlementPeriodStartMonth", label: "Abrechnungsbeginn (Monat)", type: "integer", synonyms: ["abrechnungsbeginn", "wirtschaftsjahr beginn", "abrechnungsmonat"] },
    ],
  },
  buildings: {
    key: "buildings",
    label: "Gebäude",
    names: ["gebaeude", "gebäude", "haeuser", "häuser", "buildings"],
    order: 2,
    fields: [
      { key: "propertyCode", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "obj-nr", "obj nr", "objekt"] },
      { key: "name", label: "Gebäude", type: "text", required: true, synonyms: ["gebäudename", "haus", "bezeichnung", "name"] },
      { key: "street", label: "Straße", type: "text", synonyms: ["strasse", "str"] },
      { key: "houseNumber", label: "Hausnummer", type: "text", synonyms: ["hausnr", "hnr"] },
      { key: "postalCode", label: "PLZ", type: "postalCode", synonyms: ["postleitzahl"] },
      { key: "city", label: "Ort", type: "text", synonyms: ["stadt"] },
      { key: "yearBuilt", label: "Baujahr", type: "integer" },
      { key: "usage", label: "Nutzung", type: "enum", values: USAGES, synonyms: ["gebäudenutzung"] },
    ],
  },
  units: {
    key: "units",
    label: "Einheiten",
    names: ["einheiten", "einheit", "wohnungen", "mieteinheiten", "units"],
    order: 3,
    fields: [
      { key: "propertyCode", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "obj-nr", "obj nr", "objekt"] },
      { key: "number", label: "Einheit", type: "text", required: true, synonyms: ["einheitennummer", "einheit-nr", "we-nr", "wohnungsnummer", "nummer", "einheitnr"] },
      { key: "buildingName", label: "Gebäude", type: "text", synonyms: ["haus"] },
      { key: "type", label: "Typ", type: "enum", required: true, values: UNIT_TYPES, synonyms: ["art", "einheitentyp", "nutzungsart"], hint: "Wohnung, Gewerbe, Stellplatz, Garage, Nebenfläche" },
      { key: "floor", label: "Etage", type: "text", synonyms: ["geschoss", "stockwerk", "lage etage"] },
      { key: "position", label: "Lage", type: "text", synonyms: ["position", "lage im haus"] },
      { key: "livingArea", label: "Wohnfläche", type: "decimal", synonyms: ["wohnfläche m²", "wohnflaeche", "wfl", "fläche", "qm"] },
      { key: "usableArea", label: "Nutzfläche", type: "decimal", synonyms: ["nutzflaeche", "nfl"] },
      { key: "heatedArea", label: "Heizfläche", type: "decimal", synonyms: ["heizflaeche", "beheizte fläche"] },
      { key: "mea", label: "MEA", type: "decimal", synonyms: ["miteigentumsanteil", "miteigentumsanteile", "anteil"] },
      { key: "persons", label: "Personen", type: "decimal", synonyms: ["personenzahl", "bewohner", "anzahl personen"] },
      { key: "validFrom", label: "Gültig ab", type: "date", synonyms: ["stichtag", "werte gültig ab", "ab"], hint: "Stichtag für Flächen und Anteile; leer = 01.01. des laufenden Jahres" },
      { key: "linkedPropertyCode", label: "WEG-Objektnummer", type: "text", synonyms: ["weg objektnummer", "verknüpftes objekt"], hint: "Nur SEV: Objekt der WEG" },
      { key: "linkedUnitNumber", label: "WEG-Einheit", type: "text", synonyms: ["weg einheit", "verknüpfte einheit"], hint: "Nur SEV: Einheit in der WEG" },
    ],
  },
  persons: {
    key: "persons",
    label: "Personen",
    names: ["personen", "person", "kontakte", "adressen", "stammdaten personen", "persons"],
    order: 4,
    fields: [
      { key: "externalKey", label: "Personennummer", type: "text", required: true, synonyms: ["personen-nr", "personennr", "kundennummer", "adressnummer", "id", "nr"] },
      { key: "kind", label: "Art", type: "enum", values: PERSON_KINDS, synonyms: ["personenart"], hint: "natürlich oder juristisch; leer = natürlich, wenn Nachname gefüllt" },
      { key: "salutation", label: "Anrede", type: "text" },
      { key: "title", label: "Titel", type: "text" },
      { key: "firstName", label: "Vorname", type: "text" },
      { key: "lastName", label: "Nachname", type: "text", synonyms: ["name", "familienname"] },
      { key: "companyName", label: "Firma", type: "text", synonyms: ["firmenname", "unternehmen"] },
      { key: "birthDate", label: "Geburtsdatum", type: "date", synonyms: ["geb.", "geboren"] },
      { key: "email", label: "E-Mail", type: "email", synonyms: ["email", "mail", "e-mail-adresse"] },
      { key: "phone", label: "Telefon", type: "text", synonyms: ["tel", "telefonnummer"] },
      { key: "mobile", label: "Mobil", type: "text", synonyms: ["handy", "mobiltelefon"] },
      { key: "street", label: "Straße", type: "text", synonyms: ["strasse", "str"] },
      { key: "houseNumber", label: "Hausnummer", type: "text", synonyms: ["hausnr", "hnr"] },
      { key: "postalCode", label: "PLZ", type: "text", synonyms: ["postleitzahl"] },
      { key: "city", label: "Ort", type: "text", synonyms: ["stadt", "wohnort"] },
      { key: "country", label: "Land", type: "text", hint: "ISO-Code, z. B. DE" },
      { key: "communicationPreference", label: "Kommunikation", type: "enum", values: CHANNELS, synonyms: ["kommunikationsweg", "versandart"] },
      { key: "iban", label: "IBAN", type: "iban", synonyms: ["bankverbindung", "kontonummer iban"] },
    ],
  },
  roles: {
    key: "roles",
    label: "Rollen",
    names: ["rollen", "zuordnungen", "beteiligte", "eigentuemer und mieter", "roles"],
    order: 5,
    fields: [
      { key: "personKey", label: "Personennummer", type: "text", required: true, synonyms: ["personen-nr", "personennr", "person"] },
      { key: "role", label: "Rolle", type: "enum", required: true, values: ROLES, synonyms: ["funktion", "beziehung"] },
      { key: "propertyCode", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "obj-nr", "obj nr", "objekt"] },
      { key: "unitNumber", label: "Einheit", type: "text", synonyms: ["einheitennummer", "we-nr", "wohnung"] },
      { key: "validFrom", label: "Von", type: "date", synonyms: ["beginn", "gültig ab", "einzug", "seit"] },
      { key: "validTo", label: "Bis", type: "date", synonyms: ["ende", "gültig bis", "auszug"], hint: "Erster Tag, an dem die Rolle nicht mehr gilt, oder leer" },
      { key: "share", label: "Anteil", type: "text", hint: "Miteigentum als Bruch, z. B. 1/2" },
    ],
  },
  assets: {
    key: "assets",
    label: "Anlagen",
    names: ["anlagen", "technik", "technische anlagen", "assets"],
    order: 6,
    fields: [
      { key: "propertyCode", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "obj-nr", "obj nr", "objekt"] },
      { key: "buildingName", label: "Gebäude", type: "text" },
      { key: "kind", label: "Art", type: "enum", required: true, values: ASSET_KINDS, synonyms: ["anlagenart", "typ"] },
      { key: "name", label: "Bezeichnung", type: "text", required: true, synonyms: ["name", "anlage"] },
      { key: "installedOn", label: "Einbau", type: "date", synonyms: ["einbaudatum", "inbetriebnahme", "baujahr anlage"] },
      { key: "energyCarrier", label: "Energieträger", type: "enum", values: CARRIERS, synonyms: ["brennstoff", "energietraeger"] },
      { key: "lastInspectionOn", label: "Letzte Prüfung", type: "date", synonyms: ["letzte wartung", "prüfdatum", "letzte pruefung"] },
      { key: "largeSystem", label: "Großanlage", type: "boolean", synonyms: ["grossanlage", "großanlage trinkwasser"], hint: "Nur Trinkwasser: ja/nein" },
    ],
  },
  meters: {
    key: "meters",
    label: "Zähler",
    names: ["zaehler", "zähler", "messgeraete", "messgeräte", "meters"],
    order: 7,
    fields: [
      { key: "propertyCode", label: "Objektnummer", type: "text", required: true, synonyms: ["objekt-nr", "objektnr", "obj-nr", "obj nr", "objekt"] },
      { key: "unitNumber", label: "Einheit", type: "text", synonyms: ["einheitennummer", "we-nr"] },
      { key: "kind", label: "Art", type: "enum", required: true, values: METER_KINDS, synonyms: ["zählerart", "zaehlerart", "typ"] },
      { key: "serialNumber", label: "Zählernummer", type: "text", required: true, synonyms: ["zaehlernummer", "seriennummer", "gerätenummer", "nummer"] },
      { key: "location", label: "Ort", type: "text", synonyms: ["einbauort", "standort"] },
      { key: "remoteReadable", label: "Fernablesbar", type: "boolean", synonyms: ["funk", "fernauslesbar"] },
      { key: "interoperable", label: "Interoperabel", type: "boolean" },
      { key: "calibrationValidUntil", label: "Eichung gültig bis", type: "date", synonyms: ["eichfrist", "eichung bis"] },
      { key: "calibrationYear", label: "Eichjahr", type: "integer", synonyms: ["jahr der eichung"] },
    ],
  },
};

export const ENTITY_ORDER: EntityKey[] = (Object.values(ENTITIES) as EntityDef[]).sort((a, b) => a.order - b.order).map((e) => e.key);
