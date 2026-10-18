/** Prüft docs/anforderungen.md: V1–V32 vollständig, gültige Status, alle genannten Pfade existieren. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const doc = readFileSync(path.join(root, "docs/anforderungen.md"), "utf8");
const rows = doc.split("\n").filter((l) => /^\| [A-Z]\d/.test(l) || /^\| (A0|V|M|L|N)\d/.test(l));
const problems = [];

for (let i = 1; i <= 32; i++) {
  if (!rows.some((r) => r.startsWith(`| V${i} |`))) problems.push(`V${i} fehlt`);
}
for (const row of rows) {
  const id = row.split("|")[1].trim();
  if (!/umgesetzt|teilweise|geplant/.test(row)) problems.push(`${id}: kein gültiger Status`);
  for (const [, p] of row.matchAll(/`([^`]+)`/g)) {
    if (!/[/.]/.test(p) || p.startsWith("/v1") || p.includes(" ")) continue; // nur Dateipfade
    if (!existsSync(path.join(root, p))) problems.push(`${id}: Pfad existiert nicht: ${p}`);
  }
}
if (problems.length) {
  console.error(`Rückverfolgbarkeit unvollständig:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
const count = (s) => rows.filter((r) => r.includes(`| ${s}`)).length;
console.log(`Rückverfolgbarkeit geprüft: ${rows.length} Anforderungen (${count("umgesetzt")} umgesetzt, ${count("teilweise")} teilweise, ${count("geplant")} geplant).`);
