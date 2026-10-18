import { migrate } from "./migrate";

const command = process.argv[2];

async function main() {
  if (command === "migrate") {
    const url = process.env.DATABASE_OWNER_URL;
    if (!url) throw new Error("DATABASE_OWNER_URL fehlt (Verbindung als hv_owner).");
    const result = await migrate(url);
    console.log(`Migrationen eingespielt: ${result.applied.length ? result.applied.join(", ") : "keine neuen"}`);
    return;
  }
  console.error("Verwendung: tsx src/cli.ts migrate");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
