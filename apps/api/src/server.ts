import { createDb, createPool } from "@hv/db";
import { today } from "@hv/deadlines";
import { buildApp } from "./app";
import { createAuthenticator } from "./auth";
import { loadConfig } from "./config";
import { syncRuleCatalog } from "./rules-sync";

const config = loadConfig();
const appDb = createDb(createPool(config.DATABASE_URL, { applicationName: "hv-api" }));
const ownerDb = createDb(createPool(config.DATABASE_OWNER_URL, { max: 2, applicationName: "hv-api-owner" }));

const app = await buildApp({
  deps: { appDb, ownerDb, auth: createAuthenticator(config), today: () => today(config.TIME_ZONE) },
  logger: { level: config.LOG_LEVEL },
});

const synced = await syncRuleCatalog(ownerDb);
app.log.info(synced, "Regelkatalog synchronisiert");

const shutdown = async () => {
  await app.close();
  await appDb.destroy();
  await ownerDb.destroy();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.HOST, port: config.PORT });
