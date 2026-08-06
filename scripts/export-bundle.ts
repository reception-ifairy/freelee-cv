/**
 * Exports one team's data as a single JSON bundle — the `npx tsx` power-user
 * counterpart to the self-service export route
 * (src/app/(app)/dashboard/team/export/route.ts). Builds its own raw
 * Drizzle client (same reason src/db/seed.ts does) rather than importing
 * the `server-only`-guarded `@/db`, since this runs outside Next.js
 * entirely. See docs/15-data-portability.md.
 *
 *   npx tsx scripts/export-bundle.ts --team=<teamId> [--out=path.json]
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { buildExportBundle } from '../src/lib/portability/bundle';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const teamId = arg('team');
  if (!teamId) {
    console.error('Usage: npx tsx scripts/export-bundle.ts --team=<teamId> [--out=path.json]');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const bundle = await buildExportBundle(db, teamId as string);
  const out = arg('out') ?? `export-${teamId}-${Date.now()}.json`;
  await writeFile(out, JSON.stringify(bundle, null, 2));

  console.log(`Wrote ${out}`);
  console.log(`Contents: ${JSON.stringify(bundle.manifest.contents)}`);
  if (bundle.manifest.redactions.length) console.log(`Redactions: ${bundle.manifest.redactions.join('; ')}`);
  console.log(`Checksum: ${bundle.manifest.checksum}`);

  await client.end();
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
