import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let db: any;
let pool: any;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not provided");
  }
  const pg = await import("pg");
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = { 
    findMany: async () => [], 
    findFirst: async () => null,
    findUnique: async () => null, 
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {}, 
    delete: async () => ({}) 
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
  pool = { connect: async () => ({ release: () => {} }), query: async () => ({ rows: [] }) };
}
export { db, pool };

export * from "./schema";
