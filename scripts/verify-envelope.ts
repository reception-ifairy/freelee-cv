/**
 * Checks the envelope encryption for children's data (src/lib/crypto/envelope.ts,
 * docs/54-children-data.md) with a throwaway master key — never the real one.
 *
 *   npx tsx scripts/verify-envelope.ts
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const dir = mkdtempSync(path.join(tmpdir(), 'envelope-'));
const keyFile = path.join(dir, 'master-v1.key');
writeFileSync(keyFile, randomBytes(32).toString('base64'), { mode: 0o600 });

const env = await import('../src/lib/crypto/envelope');
let failed = 0;
function check(name: string, fn: () => unknown) {
  try {
    const ok = fn();
    if (ok === false) throw new Error('returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

try {
  delete process.env.FREELEE_MASTER_KEY_FILE;
  env.resetMasterKeyCache();
  check('without a master key, child features are off (fail closed)', () => !env.childFeaturesAvailable() && throws(() => env.newWrappedKey('x')));

  process.env.FREELEE_MASTER_KEY_FILE = keyFile;
  env.resetMasterKeyCache();
  check('with a master key, child features are on', () => env.childFeaturesAvailable());

  const id = 'child-a';
  const { wrapped, keyVersion } = env.newWrappedKey(id);
  const k = { profileId: id, dek: env.unwrapKey(id, wrapped) };
  const profile = { pseudonym: 'Tiger', year: 'Y4', interests: ['football'] };

  check('key version 1 from the file name', () => keyVersion === 1);
  check('a wrapped key opens only for its own profile', () => throws(() => env.unwrapKey('child-b', wrapped)));
  const sealed = env.sealJson(k, 'profile', profile);
  check('a profile round-trips', () => JSON.stringify(env.openJson(k, 'profile', sealed)) === JSON.stringify(profile));
  check('the stored bytes do not contain the plain text', () => !sealed.includes(Buffer.from('Tiger')));
  check('two seals of the same value differ (random IV)', () => !sealed.equals(env.sealJson(k, 'profile', profile)));
  check('one flipped byte is detected', () => {
    const bad = Buffer.from(sealed);
    bad[bad.length - 1] ^= 1;
    return throws(() => env.openJson(k, 'profile', bad));
  });
  check('a value moved to another field does not open', () => throws(() => env.openJson(k, 'plan', sealed)));
  const other = { profileId: 'child-b', dek: env.unwrapKey('child-b', env.newWrappedKey('child-b').wrapped) };
  check("another child's key does not open it", () => throws(() => env.openJson(other, 'profile', sealed)));
  const text = env.sealText(k, 'message', 'What is 3/4 of 12?');
  check('message text is marked and round-trips', () => env.isSealedText(text) && env.openText(k, 'message', text) === 'What is 3/4 of 12?');
  check('plain (legacy) text passes through openText unchanged', () => env.openText(k, 'message', 'hello') === 'hello');

  const v2 = { version: 2, key: randomBytes(32) };
  const v1 = env.masterKey()!;
  const rewrapped = env.rewrapKey(id, wrapped, v1, v2);
  check('rotation re-wraps the data key; old data still opens with it', () => {
    const file2 = path.join(dir, 'master-v2.key');
    writeFileSync(file2, v2.key.toString('base64'), { mode: 0o600 });
    process.env.FREELEE_MASTER_KEY_FILE = file2;
    env.resetMasterKeyCache();
    const dek = env.unwrapKey(id, rewrapped);
    return env.openJson<{ pseudonym: string }>({ profileId: id, dek }, 'profile', sealed).pseudonym === 'Tiger';
  });
  check('a key wrapped under v1 is refused by a v2 server with a clear message', () => {
    try { env.unwrapKey(id, wrapped); return false; } catch (e) { return String(e).includes('rotate-master-key'); }
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nenvelope encryption: all checks passed');
process.exit(failed ? 1 : 0);
