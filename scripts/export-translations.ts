/**
 * Exports every row of the `translations` table — all namespaces, all
 * non-English locales — as one JSON array. Unlike scripts/export-bundle.ts
 * (Phase 8, team-scoped), translations aren't team data at all, so this is
 * a plain full-table dump: the whole point of this table is one shared,
 * admin-controlled site language, not per-team content.
 *
 * For a coworker working locally without production DB access: run this on
 * the server, send them the file through a private channel (same rule as
 * CONTRIBUTING.md's data export — never commit it, translations content
 * itself is low-sensitivity but there's no reason to make it public before
 * it's reviewed), they run scripts/import-translations.ts locally.
 *
 *   npx tsx scripts/export-translations.ts [--out=i18n/translations-export.json]
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { translations } from '../src/db/schema';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const rows = await db
    .select({ namespace: translations.namespace, key: translations.key, locale: translations.locale, value: translations.value })
    .from(translations)
    .orderBy(translations.namespace, translations.locale, translations.key);

  const outPath = arg('out') ?? 'i18n/translations-export.json';
  await writeFile(outPath, `${JSON.stringify(rows, null, 2)}\n`);

  const byNamespaceLocale = new Map<string, number>();
  for (const row of rows) {
    const bucket = `${row.namespace}/${row.locale}`;
    byNamespaceLocale.set(bucket, (byNamespaceLocale.get(bucket) ?? 0) + 1);
  }

  console.log(`Exported ${rows.length} row(s) -> ${outPath}`);
  for (const [bucket, count] of byNamespaceLocale) console.log(`  ${bucket}: ${count}`);

  await client.end();
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
