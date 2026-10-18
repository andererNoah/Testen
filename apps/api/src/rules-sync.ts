import type { Db } from "@hv/db";
import { rules } from "@hv/rules";

/** Mirrors the rule catalog into legal_rules / legal_rule_versions (ADR-0005). Owner connection. */
export async function syncRuleCatalog(ownerDb: Db): Promise<{ rules: number; versions: number }> {
  const issues = rules.validate();
  if (issues.length) throw new Error(`Regelkatalog fehlerhaft: ${issues.map((i) => `${i.key}: ${i.problem}`).join("; ")}`);
  let versions = 0;
  await ownerDb.transaction().execute(async (trx) => {
    for (const def of rules.list()) {
      await trx
        .insertInto("legal_rules")
        .values({ key: def.key, title: def.title, area: def.area, description: def.description })
        .onConflict((oc) => oc.column("key").doUpdateSet({ title: def.title, area: def.area, description: def.description, synced_at: new Date() }))
        .execute();
      await trx.deleteFrom("legal_rule_versions").where("rule_key", "=", def.key).execute();
      for (const v of def.versions) {
        versions++;
        await trx
          .insertInto("legal_rule_versions")
          .values({
            rule_key: def.key,
            version: v.version,
            valid_from: v.validFrom,
            valid_to: v.validTo ?? null,
            status: v.status,
            summary: v.summary,
            params: JSON.stringify(v.params),
            sources: JSON.stringify(v.sources),
            recht_pruefen: v.rechtPruefen ?? [],
            changelog: v.changelog ?? null,
          })
          .execute();
      }
    }
    const keys = rules.list().map((d) => d.key);
    await trx.deleteFrom("legal_rules").where("key", "not in", keys).execute();
  });
  return { rules: rules.list().length, versions };
}
