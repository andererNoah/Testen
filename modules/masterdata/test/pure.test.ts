import { describe, expect, it } from "vitest";
import { isValidIban, koelnerPhonetik, personPhoneticKey } from "@hv/masterdata";

describe("Kölner Phonetik", () => {
  it.each([
    ["Müller", "657"],
    ["Mueller", "657"],
    ["Meier", "67"],
    ["Maier", "67"],
    ["Mayer", "67"],
    ["Meyer", "67"],
    ["Wikipedia", "3412"],
    ["Müller-Lüdenscheidt", "65752682"],
    ["Schmidt", "862"],
    ["Schmitt", "862"],
    ["", ""],
  ])("%s → %s", (name, code) => {
    expect(koelnerPhonetik(name)).toBe(code);
  });

  it("baut Schlüssel für natürliche und juristische Personen", () => {
    expect(personPhoneticKey({ kind: "natural", lastName: "Meyer", firstName: "Hans" })).toBe(personPhoneticKey({ kind: "natural", lastName: "Maier", firstName: "Hanns" }));
    expect(personPhoneticKey({ kind: "legal", companyName: "Hausmeister GmbH" })).toMatch(/^L:/);
  });
});

describe("IBAN", () => {
  it("prüft die Prüfziffer", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE8937040044053201300")).toBe(false);
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
  });
});
