import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Envelope encryption for children's data (docs/54-children-data.md).
 *
 * Owner decision 2026-11-12: a child's profile, plan and chats are encrypted
 * in the application, on our own server, before they reach the database.
 *
 * - **Master key (KEK)** — 32 bytes in a root-only file outside the repository
 *   and the database (`FREELEE_MASTER_KEY_FILE`, e.g.
 *   /etc/freelee/keys/master-v1.key). The owner keeps an offline copy. It never
 *   encrypts data directly; it only wraps the per-child keys.
 * - **Data key (DEK)** — 32 random bytes per child profile, stored wrapped by
 *   the master key in `child_profiles.wrapped_key`. Deleting a profile deletes
 *   its wrapped key, which makes everything encrypted with it unreadable
 *   ("crypto-shredding"; database backups follow when they expire).
 * - **AES-256-GCM** with a random 96-bit IV per value and associated data that
 *   names what the value is (`child:<id>:profile`, `child:<id>:message`…), so a
 *   ciphertext copied onto another row or field fails to decrypt instead of
 *   being read as something else.
 *
 * Format of a sealed value: `v1` | key version (1 byte) | iv (12) | tag (16) |
 * ciphertext. As text (messages.content) it is `enc:v1:` + base64.
 *
 * Fail closed: without the master key file nothing child-related can be read
 * or written (`childFeaturesAvailable()` is false) — the rest of the app works.
 * Not encrypted with the parent's password on purpose: tutors must be able to
 * read the plan while the child learns, without the parent typing anything.
 */

const MAGIC = Buffer.from('v1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
export const TEXT_PREFIX = 'enc:v1:';

export class MissingMasterKeyError extends Error {
  constructor() {
    super('Children’s data is unavailable: the encryption key is not configured on this server.');
    this.name = 'MissingMasterKeyError';
  }
}

type MasterKey = { version: number; key: Buffer };
let cached: MasterKey | null | undefined;

/** Reads the master key once per process; null when the file is not configured or unreadable. */
export function masterKey(): MasterKey | null {
  if (cached !== undefined) return cached;
  const file = process.env.FREELEE_MASTER_KEY_FILE;
  cached = null;
  if (!file) return cached;
  try {
    const raw = readFileSync(file, 'utf8').trim();
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== KEY_BYTES) return cached;
    const version = Number(/master-v(\d+)/.exec(file)?.[1] ?? 1);
    cached = { version, key };
  } catch {
    cached = null;
  }
  return cached;
}

/** For scripts and tests that swap the key file. */
export function resetMasterKeyCache(): void {
  cached = undefined;
}

export function childFeaturesAvailable(): boolean {
  return masterKey() !== null;
}

function requireMaster(): MasterKey {
  const master = masterKey();
  if (!master) throw new MissingMasterKeyError();
  return master;
}

function seal(key: Buffer, version: number, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([version & 0xff]), iv, cipher.getAuthTag(), ciphertext]);
}

function open(key: Buffer, sealed: Buffer, aad: string): Buffer {
  if (sealed.length < MAGIC.length + 1 + IV_BYTES + TAG_BYTES || !sealed.subarray(0, 2).equals(MAGIC)) {
    throw new Error('Not an encrypted value.');
  }
  const iv = sealed.subarray(3, 3 + IV_BYTES);
  const tag = sealed.subarray(3 + IV_BYTES, 3 + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed.subarray(3 + IV_BYTES + TAG_BYTES)), decipher.final()]);
}

/** The key version a sealed value (or wrapped key) was made with. */
export function sealedVersion(sealed: Buffer): number {
  return sealed[2];
}

/* ------------------------------ data keys ------------------------------ */

/** A new random data key for one child, already wrapped by the master key. */
export function newWrappedKey(profileId: string): { wrapped: Buffer; keyVersion: number } {
  const master = requireMaster();
  const dek = randomBytes(KEY_BYTES);
  return { wrapped: seal(master.key, master.version, dek, `dek:${profileId}`), keyVersion: master.version };
}

export function unwrapKey(profileId: string, wrapped: Buffer): Buffer {
  const master = requireMaster();
  if (sealedVersion(wrapped) !== master.version) {
    throw new Error(`This data key was wrapped by master key v${sealedVersion(wrapped)}; the server has v${master.version}. Run scripts/rotate-master-key.ts.`);
  }
  return open(master.key, wrapped, `dek:${profileId}`);
}

/** Re-wraps a data key under another master key (rotation); the data itself is not touched. */
export function rewrapKey(profileId: string, wrapped: Buffer, from: { version: number; key: Buffer }, to: { version: number; key: Buffer }): Buffer {
  const dek = open(from.key, wrapped, `dek:${profileId}`);
  return seal(to.key, to.version, dek, `dek:${profileId}`);
}

/* ------------------------------ values ------------------------------ */

export type ChildKey = { profileId: string; dek: Buffer };

const aadFor = (k: ChildKey, field: string) => `child:${k.profileId}:${field}`;

export function sealJson(k: ChildKey, field: string, value: unknown): Buffer {
  return seal(k.dek, 1, Buffer.from(JSON.stringify(value), 'utf8'), aadFor(k, field));
}

export function openJson<T>(k: ChildKey, field: string, sealed: Buffer): T {
  return JSON.parse(open(k.dek, sealed, aadFor(k, field)).toString('utf8')) as T;
}

/** Text for a text column (chat messages): `enc:v1:<base64>`. */
export function sealText(k: ChildKey, field: string, text: string): string {
  return TEXT_PREFIX + seal(k.dek, 1, Buffer.from(text, 'utf8'), aadFor(k, field)).toString('base64');
}

export function isSealedText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEXT_PREFIX);
}

export function openText(k: ChildKey, field: string, value: string): string {
  if (!isSealedText(value)) return value;
  return open(k.dek, Buffer.from(value.slice(TEXT_PREFIX.length), 'base64'), aadFor(k, field)).toString('utf8');
}
