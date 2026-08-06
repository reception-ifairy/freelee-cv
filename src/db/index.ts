import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * One pooled connection reused across hot reloads. Without the global cache,
 * `next dev` opens a new pool on every file change and exhausts the database's
 * connection limit within minutes.
 */
const globalForDb = globalThis as unknown as { conn?: postgres.Sql };

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
}

/**
 * Pool size must be capped explicitly. Serverless platforms open one pool per
 * concurrent lambda, so an unbounded default exhausts the database's
 * connection limit long before traffic becomes interesting. `DB_POOL_MAX`
 * also lets a build run against a single-connection database.
 */
const poolMax = Number(process.env.DB_POOL_MAX ?? (process.env.NODE_ENV === 'production' ? 10 : 3));

const conn =
  globalForDb.conn ??
  postgres(connectionString, {
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export { schema };
export type Db = typeof db;
