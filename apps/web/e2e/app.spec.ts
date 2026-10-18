import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const DEMO = path.resolve(import.meta.dirname, "../../../demo/import");

async function login(page: Page, name: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/anmelden/);
  await page.getByRole("button", { name: `Als ${name} anmelden` }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
}

/** WCAG 2.2 AA: no serious or critical axe findings. */
async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const relevant = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(relevant.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual([]);
}

test("Anmeldeseite ist barrierefrei", async ({ page }) => {
  await page.goto("/anmelden");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expectAccessible(page);
});

test("Admin: Startseite, Objekt-360°, Deep-Links und Zurück-Taste (V24, V32)", async ({ page }) => {
  await login(page, "Anna Admin");
  await expect(page.getByRole("heading", { name: /Guten Tag, Anna/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fristen nach Dringlichkeit" })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Objekte", exact: true }).click();
  await expect(page).toHaveTitle(/Objekte/);
  await expectAccessible(page);
  await page.getByRole("link", { name: "WEG Lindenstraße 12" }).click();
  await expect(page.getByRole("heading", { name: "W001 · WEG Lindenstraße 12" })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("tab", { name: /Einheiten/ }).click();
  await expect(page).toHaveURL(/ansicht=einheiten/);
  await expect(page.getByRole("link", { name: "WE 03" })).toBeVisible();
  await expect(page.getByText("Dr. Claudia Neumann")).toBeVisible();
  await expectAccessible(page);

  await page.goBack();
  await expect(page.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");

  // Deep link straight into a tab
  const url = page.url().split("?")[0];
  await page.goto(`${url}?ansicht=technik`);
  await expect(page.getByRole("tab", { name: "Technik" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Gas-Brennwertkessel")).toBeVisible();
});

test("Befehlspalette mit Strg+K (≤ 3 Interaktionen)", async ({ page }) => {
  await login(page, "Anna Admin");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox", { name: "Suchbegriff" });
  await expect(search).toBeFocused();
  await search.fill("Gohl");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "M001 · Mietshaus Gohliser Straße 8" })).toBeVisible();
});

test("Einheit: bitemporale Historie und Stichtag", async ({ page }) => {
  await login(page, "Anna Admin");
  await page.goto("/objekte");
  await page.getByRole("link", { name: "Mietshaus Gohliser Straße 8" }).click();
  await page.getByRole("tab", { name: /Einheiten/ }).click();
  await page.getByRole("link", { name: "WE 02" }).click();
  await expect(page.getByRole("heading", { name: "Einheit WE 02" })).toBeVisible();
  await expect(page.getByText("Historie (bitemporal)")).toBeVisible();
  await expectAccessible(page);
});

test("Fristen: Filter, Rechtsgrundlage mit Quelle", async ({ page }) => {
  await login(page, "Anna Admin");
  await page.getByRole("link", { name: "Fristen", exact: true }).click();
  await page.getByRole("button", { name: /Dringend/ }).click();
  await expect(page).toHaveURL(/status=critical/);
  await expect(page.getByText("Wartung Rauchwarnmelder").first()).toBeVisible();
  await expect(page.getByText("RECHT-PRÜFEN R-006").first()).toBeVisible();
  await expectAccessible(page);
});

test("Regeln, Audit-Log und Personen sind barrierefrei", async ({ page }) => {
  await login(page, "Anna Admin");
  for (const [link, text] of [
    ["Regeln & Recht", "Frist für die Betriebskostenabrechnung"],
    ["Audit-Log", "Zeitpunkt"],
    ["Personen", "Thomas Weber"],
  ] as const) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByText(text).first()).toBeVisible();
    await expectAccessible(page);
  }
});

test("Dublettenwarnung beim Anlegen einer Person (V29)", async ({ page }) => {
  await login(page, "Anna Admin");
  await page.goto("/personen?neu=1");
  const dialog = page.getByRole("dialog", { name: "Person anlegen" });
  await dialog.getByLabel("Vorname").fill("Thomas");
  await dialog.getByLabel("Nachname").fill("Webber");
  await dialog.getByLabel("E-Mail").fill("thomas.weber@example.org");
  await dialog.getByRole("button", { name: "Anlegen" }).click();
  await expect(dialog.getByText("Diese Person gibt es vermutlich schon.")).toBeVisible();
  await expect(dialog.getByText(/gleiche E-Mail-Adresse/)).toBeVisible();
  await expectAccessible(page);
});

test("Import-Assistent: hochladen, prüfen, Bericht (V20)", async ({ page }) => {
  await login(page, "Anna Admin");
  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expectAccessible(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Dateien auswählen" }).click();
  await (await chooser).setFiles([path.join(DEMO, "objekte.csv"), path.join(DEMO, "einheiten.csv")]);
  await page.getByRole("button", { name: "Hochladen und analysieren" }).click();
  await expect(page.getByText("2. Zuordnung prüfen")).toBeVisible();
  await expect(page).toHaveURL(/auftrag=/);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Prüfen (Probeimport)" }).click();
  await expect(page.getByText("3. Validierungsbericht")).toBeVisible();
  await expect(page.getByText("Keine Fehler")).toBeVisible();
  // Demo data is already there: everything unchanged
  const unitsRow = page.getByRole("row", { name: /Einheiten/ });
  await expect(unitsRow.getByRole("cell").nth(3)).toHaveText("22");
});

test("Mieter sieht nur die eigene Wohnung und keine Verwaltungsseiten", async ({ page }) => {
  await login(page, "Paul Richter");
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Objekte" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Fristen" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Audit-Log" })).toHaveCount(0);
  await nav.getByRole("link", { name: "Objekte" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("link", { name: "Mietshaus Gohliser Straße 8" }).click();
  await page.getByRole("tab", { name: /Einheiten/ }).click();
  await expect(page.getByRole("link", { name: "WE 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WE 02" })).toHaveCount(0);
});

test("Dunkles Design ist ebenfalls barrierefrei", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page, "Anna Admin");
  await expect(page.getByRole("heading", { name: "Fristen nach Dringlichkeit" })).toBeVisible();
  await expectAccessible(page);
});
