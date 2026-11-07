import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { lonceng?: { pool: pg.Pool; db: Db } };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur");
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 20) });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Lazily connected so importing this module during `next build` needs no database. */
export function getDb(): Db {
  globalForDb.lonceng ??= connect();
  return globalForDb.lonceng.db;
}

export async function closeDb() {
  await globalForDb.lonceng?.pool.end();
  globalForDb.lonceng = undefined;
}
