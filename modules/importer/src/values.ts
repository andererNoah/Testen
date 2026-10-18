import { isValidDate } from "@hv/deadlines";
import { isValidIban, normalizeIban } from "@hv/masterdata";
import type { FieldDef } from "./fields";
import { normalizeToken } from "./normalize";

export type ParsedValue = string | number | boolean | null;

export class ValueError extends Error {}

/** German-friendly value parsing for import cells. Empty cells become null. */
export function parseValue(field: FieldDef, raw: string): ParsedValue {
  const value = raw.trim();
  if (value === "") return null;
  switch (field.type) {
    case "text":
      return value;
    case "integer": {
      const cleaned = value.replace(/\./g, "").replace(/\s/g, "");
      if (!/^-?\d+$/.test(cleaned)) throw new ValueError(`„${value}“ ist keine ganze Zahl`);
      return Number(cleaned);
    }
    case "decimal": {
      // "1.234,56" | "62,5" | "62.5" → "1234.56" etc. (string keeps it exact)
      let v = value.replace(/\s|m²|qm/gi, "");
      if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
      else v = v.replace(",", ".");
      if (!/^\d+(\.\d+)?$/.test(v)) throw new ValueError(`„${value}“ ist keine Zahl`);
      const [int, frac = ""] = v.split(".");
      if (frac.length > 4) throw new ValueError(`„${value}“ hat mehr als vier Nachkommastellen`);
      return frac ? `${int}.${frac}` : int!;
    }
    case "date": {
      let iso: string | null = null;
      let m: RegExpExecArray | null;
      if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value))) iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
      else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(value))) {
        const year = Number(m[3]);
        iso = `${year > 50 ? 1900 + year : 2000 + year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) iso = value.slice(0, 10);
      if (!iso || !isValidDate(iso)) throw new ValueError(`„${value}“ ist kein gültiges Datum (TT.MM.JJJJ)`);
      return iso;
    }
    case "boolean": {
      const v = normalizeToken(value);
      if (["ja", "j", "x", "1", "true", "wahr", "yes", "y"].includes(v)) return true;
      if (["nein", "n", "0", "false", "falsch", "no", "-"].includes(v)) return false;
      throw new ValueError(`„${value}“ ist weder ja noch nein`);
    }
    case "enum": {
      const values = field.values ?? {};
      const direct = values[value.toLowerCase()];
      if (direct) return direct;
      const token = normalizeToken(value);
      for (const [spelling, code] of Object.entries(values)) {
        if (normalizeToken(spelling) === token) return code;
      }
      if (Object.values(values).includes(value)) return value;
      throw new ValueError(`„${value}“ ist kein erlaubter Wert${field.hint ? ` (${field.hint})` : ""}`);
    }
    case "postalCode": {
      const v = value.padStart(5, "0");
      if (!/^\d{5}$/.test(v)) throw new ValueError(`„${value}“ ist keine fünfstellige Postleitzahl`);
      return v;
    }
    case "email": {
      const v = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ValueError(`„${value}“ ist keine gültige E-Mail-Adresse`);
      return v;
    }
    case "iban": {
      const v = normalizeIban(value);
      if (!isValidIban(v)) throw new ValueError(`„${value}“ ist keine gültige IBAN (Prüfziffer)`);
      return v;
    }
  }
}
