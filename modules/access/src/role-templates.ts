import type { ScopeType } from "@hv/db";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  typicalScope: ScopeType;
  permissions: Permission[];
}

const staffRead: Permission[] = ["masterdata.read", "persons.read", "documents.read", "rules.read", "deadlines.read"];

/** Created for every new tenant; tenants may adapt them (docs/rechtekonzept.md). */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  { key: "tenant_admin", name: "Mandanten-Admin", description: "Verwaltet den gesamten Mandanten", typicalScope: "tenant", permissions: ALL_PERMISSIONS },
  {
    key: "property_manager",
    name: "Objektbetreuer",
    description: "Betreut zugewiesene Objekte",
    typicalScope: "property",
    permissions: [...staffRead, "masterdata.write", "persons.write", "documents.write", "import.run"],
  },
  { key: "accountant", name: "Buchhaltung", description: "Finanzen der zugewiesenen Objekte", typicalScope: "property", permissions: staffRead },
  { key: "approver", name: "Freigeber (Vier-Augen)", description: "Gibt Zahlungen, Rechnungen und Abrechnungen frei", typicalScope: "tenant", permissions: ["masterdata.read", "rules.read"] },
  {
    key: "technician",
    name: "Techniker / Hausmeister",
    description: "Vorgänge, Begehung, Ablesung",
    typicalScope: "property",
    permissions: ["masterdata.read", "documents.read", "deadlines.read"],
  },
  { key: "advisory_board", name: "Beirat", description: "Prüft die eigene WEG", typicalScope: "property", permissions: ["masterdata.read", "documents.read"] },
  { key: "owner", name: "Eigentümer", description: "Eigene Einheiten und Gemeinschaftsunterlagen", typicalScope: "unit", permissions: ["masterdata.read", "documents.read"] },
  { key: "renter", name: "Mieter", description: "Eigenes Mietverhältnis", typicalScope: "unit", permissions: ["masterdata.read", "documents.read"] },
  { key: "contractor", name: "Dienstleister", description: "Eigene Aufträge", typicalScope: "property", permissions: ["masterdata.read"] },
  { key: "tax_advisor", name: "Steuerberatung", description: "Lesen und exportieren", typicalScope: "property", permissions: ["masterdata.read", "persons.read", "export.run"] },
];
