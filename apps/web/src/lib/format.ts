/** German display formats. API values stay ISO strings and decimal strings. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
}

const numberFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 });
const areaFmt = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Decimal strings are formatted for display only (never used for calculation). */
export function formatDecimal(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  return numberFmt.format(Number(value));
}

export function formatArea(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  return `${areaFmt.format(Number(value))} m²`;
}

/** "62,5" → "62.5" for the API. */
export function toApiDecimal(input: string): string {
  const v = input.trim();
  return v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
}

export function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

/** "01.07.2024" or "2024-07-01" → ISO, else null */
export function parseGermanDate(input: string): string | null {
  const v = input.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? v : null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
