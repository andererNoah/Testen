import type { Row, Tx } from "@hv/db";
import { personDisplayName } from "./mappers";
import { koelnerPhonetik } from "./phonetics";
import type { DuplicateCandidate } from "./schemas";

export interface PersonFingerprint {
  kind: "natural" | "legal";
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  birthDate?: string | null;
  email?: string | null;
  iban?: string | null;
  postalCode?: string | null;
  street?: string | null;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Scores how likely `candidate` is the same person (0..1) and explains why (V29).
 * Only visible persons are compared (RLS); RECHT-PRÜFEN R-020.
 */
export function scoreDuplicate(input: PersonFingerprint, candidate: Row<"persons">): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.email && candidate.email && norm(input.email) === norm(candidate.email)) {
    score += 0.6;
    reasons.push("gleiche E-Mail-Adresse");
  }
  if (input.iban && candidate.iban && input.iban === candidate.iban) {
    score += 0.5;
    reasons.push("gleiche IBAN");
  }
  if (input.kind === "legal") {
    if (candidate.kind === "legal" && norm(input.companyName) && norm(input.companyName) === norm(candidate.company_name)) {
      score += 0.7;
      reasons.push("gleicher Firmenname");
    } else if (candidate.kind === "legal" && koelnerPhonetik(input.companyName ?? "") === koelnerPhonetik(candidate.company_name ?? "")) {
      score += 0.4;
      reasons.push("ähnlich klingender Firmenname");
    }
  } else if (candidate.kind === "natural") {
    const sameLast = norm(input.lastName) === norm(candidate.last_name);
    const similarLast = koelnerPhonetik(input.lastName ?? "") === koelnerPhonetik(candidate.last_name ?? "");
    const sameFirst = norm(input.firstName) !== "" && norm(input.firstName) === norm(candidate.first_name);
    const similarFirst = norm(input.firstName) !== "" && koelnerPhonetik(input.firstName ?? "") === koelnerPhonetik(candidate.first_name ?? "");
    if (sameLast && sameFirst) {
      score += 0.5;
      reasons.push("gleicher Name");
    } else if (similarLast && (similarFirst || !input.firstName)) {
      score += 0.35;
      reasons.push("ähnlich klingender Name");
    }
    if (input.birthDate && candidate.birth_date && input.birthDate === candidate.birth_date) {
      score += similarLast ? 0.4 : 0.1;
      reasons.push("gleiches Geburtsdatum");
    }
  }
  if (score > 0 && input.postalCode && candidate.postal_code === input.postalCode && norm(input.street) && norm(input.street) === norm(candidate.street)) {
    score += 0.15;
    reasons.push("gleiche Anschrift");
  }
  return { score: Math.min(1, Math.round(score * 100) / 100), reasons };
}

export const DUPLICATE_THRESHOLD = 0.5;

export async function findDuplicateCandidates(trx: Tx, input: PersonFingerprint, excludeId?: string): Promise<DuplicateCandidate[]> {
  const lastKey = koelnerPhonetik(input.kind === "legal" ? (input.companyName ?? "") : (input.lastName ?? ""));
  const prefix = input.kind === "legal" ? `L:${lastKey}` : `N:${lastKey}:`;
  let q = trx
    .selectFrom("persons")
    .selectAll()
    .where("merged_into_id", "is", null)
    .where((eb) => {
      const ors = [eb("phonetic_key", "like", `${prefix}%`)];
      if (input.email) ors.push(eb("email", "=", input.email));
      if (input.iban) ors.push(eb("iban", "=", input.iban));
      if (input.birthDate) ors.push(eb("birth_date", "=", input.birthDate));
      return eb.or(ors);
    })
    .limit(50);
  if (excludeId) q = q.where("id", "!=", excludeId);
  const rows = await q.execute();
  return rows
    .map((row) => ({ row, ...scoreDuplicate(input, row) }))
    .filter((c) => c.score >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ personId: c.row.id, displayName: personDisplayName(c.row), score: c.score, reasons: c.reasons }));
}
