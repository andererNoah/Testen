/**
 * Kölner Phonetik (Postel 1969): phonetic code for German names, used for duplicate detection.
 * "Meier", "Maier", "Mayer" and "Meyer" all map to "67".
 */
export function koelnerPhonetik(input: string): string {
  const word = input
    .toUpperCase()
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/ß/g, "S")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");
  if (!word) return "";

  const codes: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const c = word[i]!;
    const prev = i > 0 ? word[i - 1]! : "";
    const next = i + 1 < word.length ? word[i + 1]! : "";
    let code: string;
    switch (c) {
      case "A":
      case "E":
      case "I":
      case "J":
      case "O":
      case "U":
      case "Y":
        code = "0";
        break;
      case "H":
        code = "";
        break;
      case "B":
        code = "1";
        break;
      case "P":
        code = next === "H" ? "3" : "1";
        break;
      case "D":
      case "T":
        code = "CSZ".includes(next) && next !== "" ? "8" : "2";
        break;
      case "F":
      case "V":
      case "W":
        code = "3";
        break;
      case "G":
      case "K":
      case "Q":
        code = "4";
        break;
      case "C":
        if (i === 0) code = "AHKLOQRUX".includes(next) && next !== "" ? "4" : "8";
        else if ("SZ".includes(prev)) code = "8";
        else code = "AHKOQUX".includes(next) && next !== "" ? "4" : "8";
        break;
      case "X":
        code = "CKQ".includes(prev) && prev !== "" ? "8" : "48";
        break;
      case "L":
        code = "5";
        break;
      case "M":
      case "N":
        code = "6";
        break;
      case "R":
        code = "7";
        break;
      case "S":
      case "Z":
        code = "8";
        break;
      default:
        code = "";
    }
    codes.push(code);
  }

  // Collapse adjacent duplicates (on the raw sequence, H does not separate), then drop zeros except leading.
  let raw = "";
  for (const code of codes) {
    for (const digit of code) {
      if (raw.length === 0 || raw[raw.length - 1] !== digit) raw += digit;
    }
  }
  if (!raw) return "";
  return raw[0] + raw.slice(1).replace(/0/g, "");
}

export function personPhoneticKey(person: { kind: "natural" | "legal"; lastName?: string | null; firstName?: string | null; companyName?: string | null }): string {
  if (person.kind === "legal") return `L:${koelnerPhonetik(person.companyName ?? "")}`;
  return `N:${koelnerPhonetik(person.lastName ?? "")}:${koelnerPhonetik(person.firstName ?? "")}`;
}
