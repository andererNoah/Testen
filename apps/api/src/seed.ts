import { createDb, createPool } from "@hv/db";
import { today } from "@hv/deadlines";
import { loadConfig } from "./config";
import { DEMO_SLUG, seedDemoTenant } from "./demo-seed";
import { syncRuleCatalog } from "./rules-sync";

const config = loadConfig();
const ownerDb = createDb(createPool(config.DATABASE_OWNER_URL, { max: 2 }));
const appDb = createDb(createPool(config.DATABASE_URL, { max: 2 }));
try {
  await syncRuleCatalog(ownerDb);
  const result = await seedDemoTenant(ownerDb, appDb, today(config.TIME_ZONE));
  if (!result.created) {
    console.log(`Demo-Mandant „${DEMO_SLUG}“ existiert bereits – nichts zu tun.`);
  } else {
    console.log(`Demo-Mandant „${DEMO_SLUG}“ angelegt. Anmeldung im Entwicklungs-Login:`);
    for (const l of result.logins) console.log(`  ${l.email.padEnd(36)} ${l.displayName} – ${l.role}`);
  }
} finally {
  await ownerDb.destroy();
  await appDb.destroy();
}
