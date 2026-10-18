/** Permission catalog (docs/rechtekonzept.md). */
export const PERMISSIONS = {
  "tenant.admin": "Benutzer, Rollen, Module und eigene Felder verwalten",
  "masterdata.read": "Objekte, Gebäude, Einheiten, Flächen, Anlagen und Zähler lesen",
  "masterdata.write": "Objekte, Gebäude, Einheiten, Flächen, Anlagen und Zähler anlegen und ändern",
  "persons.read": "Personen und Personenrollen lesen",
  "persons.write": "Personen anlegen, ändern und zusammenführen",
  "import.run": "Import-Assistent ausführen",
  "audit.read": "Audit-Log lesen",
  "rules.read": "Regelkatalog lesen",
  "deadlines.read": "Fristen lesen",
  "documents.read": "Dokumente lesen",
  "documents.write": "Dokumente ablegen",
  "export.run": "Exporte ausführen",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}
