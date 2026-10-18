/**
 * Lizenzverzeichnis (Arbeitsweise): erlaubt sind nur Lizenzen, die kommerziellen SaaS-Betrieb
 * erlauben. Copyleft (GPL, AGPL, LGPL, SSPL, EUPL) nur nach Prüfung über die Ausnahmeliste.
 * Schreibt docs/lizenzen.md und bricht bei unzulässigen Lizenzen ab.
 *   node scripts/check-licenses.mjs           – prüfen und Verzeichnis schreiben
 *   node scripts/check-licenses.mjs --check   – nur prüfen (CI)
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const ALLOWED = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "BlueOak-1.0.0", "Unlicense", "CC0-1.0", "MIT/X11", "Zlib", "Python-2.0", "CC-BY-4.0"]);
/** Dev-only tools may use weak copyleft (not shipped with the product). */
const ALLOWED_DEV = new Set([...ALLOWED, "MPL-2.0"]);
/** Reviewed exceptions: package → reason. */
const EXCEPTIONS = {
  buffers: "MIT/X11 laut README; package.json ohne Lizenzfeld (Abhängigkeit von exceljs)",
};

function list(prod) {
  const args = ["licenses", "list", "--json", ...(prod ? ["--prod"] : [])];
  return JSON.parse(execFileSync("pnpm", args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }));
}

function ok(expr, allowed) {
  const e = expr.replace(/^\((.*)\)$/, "$1");
  if (e.includes(" OR ")) return e.split(" OR ").some((x) => ok(x.trim(), allowed));
  if (e.includes(" AND ")) return e.split(" AND ").every((x) => ok(x.trim(), allowed));
  return allowed.has(e);
}

const prod = list(true);
const all = list(false);
const prodNames = new Set(Object.values(prod).flat().map((p) => p.name));
const problems = [];
for (const [license, pkgs] of Object.entries(all)) {
  for (const p of pkgs) {
    const isProd = prodNames.has(p.name);
    if (EXCEPTIONS[p.name]) continue;
    if (!ok(license, isProd ? ALLOWED : ALLOWED_DEV)) problems.push(`${p.name}@${p.versions.join(",")}: ${license}${isProd ? " (Produktion)" : " (Entwicklung)"}`);
  }
}

if (!process.argv.includes("--check")) {
  const rows = Object.entries(prod)
    .flatMap(([license, pkgs]) => pkgs.map((p) => ({ name: p.name, versions: p.versions.join(", "), license, note: EXCEPTIONS[p.name] ?? "" })))
    .sort((a, b) => a.name.localeCompare(b.name));
  const summary = Object.entries(prod)
    .map(([license, pkgs]) => [license, pkgs.length])
    .sort((a, b) => b[1] - a[1]);
  const devOnly = Object.entries(all)
    .map(([license, pkgs]) => [license, pkgs.filter((p) => !prodNames.has(p.name)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const md = [
    "# Lizenzverzeichnis",
    "",
    "Erzeugt mit `pnpm licenses` (`node scripts/check-licenses.mjs`). Bitte nicht von Hand ändern. Erlaubt sind Lizenzen, die kommerziellen SaaS-Betrieb erlauben; Copyleft nur nach Prüfung. Die CI bricht bei unzulässigen Lizenzen ab.",
    "",
    "## Laufzeit-Abhängigkeiten nach Lizenz",
    "",
    "| Lizenz | Pakete |",
    "| --- | --- |",
    ...summary.map(([l, n]) => `| ${l} | ${n} |`),
    "",
    "Bei Mehrfachlizenzen (`A OR B`) nutzen wir die erlaubte Variante, z. B. MIT bei `jszip`.",
    "",
    "## Nur Entwicklung und Tests",
    "",
    "| Lizenz | Pakete |",
    "| --- | --- |",
    ...devOnly.map(([l, n]) => `| ${l} | ${n} |`),
    "",
    "MPL-2.0 betrifft nur Prüfwerkzeuge (axe-core für Barrierefreiheitstests); sie werden nicht ausgeliefert.",
    "",
    "## Geprüfte Ausnahmen",
    "",
    "| Paket | Begründung |",
    "| --- | --- |",
    ...Object.entries(EXCEPTIONS).map(([n, r]) => `| ${n} | ${r} |`),
    "",
    "## Alle Laufzeit-Abhängigkeiten",
    "",
    "| Paket | Version | Lizenz |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.name} | ${r.versions} | ${r.license}${r.note ? " (Ausnahme)" : ""} |`),
    "",
  ].join("\n");
  writeFileSync(path.resolve(import.meta.dirname, "../docs/lizenzen.md"), md);
  console.log(`docs/lizenzen.md geschrieben (${rows.length} Laufzeit-Pakete).`);
}

if (problems.length) {
  console.error(`Unzulässige Lizenzen:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("Lizenzprüfung bestanden.");
