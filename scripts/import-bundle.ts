/**
 * Imports a previously exported bundle (scripts/export-bundle.ts) into a
 * team. Defaults to `--dry-run` — reports what *would* happen (insert vs.
 * skip-as-already-imported counts per entity) without writing anything;
 * pass `--apply` to actually write, inside one transaction. See
 * docs/15-data-portability.md and src/lib/portability/import.ts.
 *
 *   npx tsx scripts/import-bundle.ts --team=<teamId> --bundle=path.json [--apply]
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import type { ExportBundle } from '../src/lib/portability/contracts';
import { importBundle } from '../src/lib/portability/import';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const teamId = arg('team');
  const bundlePath = arg('bundle');
  const apply = process.argv.includes('--apply');

  if (!teamId || !bundlePath) {
    console.error('Usage: npx tsx scripts/import-bundle.ts --team=<teamId> --bundle=path.json [--apply]');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const bundle = JSON.parse(await readFile(bundlePath as string, 'utf8')) as ExportBundle;
  console.log(`Bundle from team ${bundle.manifest.teamId}, generated ${bundle.manifest.generatedAt}`);
  console.log(`Contents: ${JSON.stringify(bundle.manifest.contents)}`);

  const summary = await importBundle(db, teamId as string, bundle, { dryRun: !apply });
  console.log(apply ? 'Applied:' : 'Dry run (pass --apply to write):', JSON.stringify(summary, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
