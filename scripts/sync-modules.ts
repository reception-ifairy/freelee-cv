/**
 * Upserts the `modules` DB table from src/lib/modules/registry.ts's MODULES
 * array. Run after any change to the registry (new module, version bump) —
 * see docs/08-module-architecture.md. Idempotent.
 *
 *   npx tsx scripts/sync-modules.ts
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { syncModuleRegistry } from '../src/lib/modules/sync';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const { inserted, updated } = await syncModuleRegistry(db);
  console.log(`Module sync OK — ${inserted} inserted, ${updated} updated.`);

  await client.end();
}

main().catch((error) => {
  console.error('Module sync failed:', error);
  process.exit(1);
});
