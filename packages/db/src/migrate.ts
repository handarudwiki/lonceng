import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./index";

await migrate(getDb(), { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await closeDb();
console.log("Migrasi selesai");
