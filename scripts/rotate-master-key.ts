/**
 * Rotates the master key for children's data (docs/54-children-data.md).
 * Re-wraps every child's data key under the new master key; the encrypted
 * profiles, plans and chats themselves are not touched.
 *
 *   npx tsx scripts/rotate-master-key.ts --from=/etc/freelee/keys/master-v1.key --to=/etc/freelee/keys/master-v2.key          # dry run
 *   ... --apply
 *
 * Then point FREELEE_MASTER_KEY_FILE at the new file, restart the app, and keep
 * the old file (and its offline copy) until a database backup taken after the
 * rotation exists. The version is read from the file name (master-v<N>.key).
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { rewrapKey, sealedVersion } from '../src/lib/crypto/envelope';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
function load(file: string) {
  const raw = readFileSync(file, 'utf8').trim();
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  const version = Number(/master-v(\d+)/.exec(file)?.[1] ?? NaN);
  if (key.length !== 32 || !Number.isInteger(version)) throw new Error(`${file}: expected 32 bytes and a name like master-v2.key`);
  return { key, version };
}

const from = load(arg('from'));
const to = load(arg('to'));
if (to.version <= from.version) throw new Error('The new key must have a higher version than the old one.');
const apply = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

try {
  const rows = await sql<{ id: string; wrapped_key: Buffer }[]>`select id, wrapped_key from child_profiles`;
  const todo = rows.filter((r) => sealedVersion(r.wrapped_key) === from.version);
  console.log(`${rows.length} profile(s); ${todo.length} wrapped under v${from.version} → v${to.version}.`);
  const next = todo.map((r) => ({ id: r.id, wrapped: rewrapKey(r.id, r.wrapped_key, from, to) }));
  if (!apply) {
    console.log('Dry run — every key re-wrapped in memory without error. Add --apply.');
  } else {
    await sql.begin(async (tx) => {
      for (const n of next) await tx`update child_profiles set wrapped_key = ${n.wrapped}, key_version = ${to.version}, updated_at = now() where id = ${n.id}`;
    });
    console.log(`Re-wrapped ${next.length}. Now set FREELEE_MASTER_KEY_FILE to the new file and restart.`);
  }
} finally {
  await sql.end();
}
