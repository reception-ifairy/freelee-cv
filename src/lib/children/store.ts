import 'server-only';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles, consents, type ChildProfileRow } from '@/db/schema';
import { newWrappedKey, openJson, sealJson, unwrapKey, type ChildKey } from '@/lib/crypto/envelope';
import { ADAPTATIONS, CONSENT_TEXT_VERSION, SUBJECTS, YEARS, isGcseYear, type ChildProfile } from './profile';

/**
 * The only code that reads or writes child profiles (docs/54-children-data.md).
 * Every read decrypts with the child's own key; every write seals. Nothing
 * here logs a profile — errors carry ids only.
 */

const subjectIds = SUBJECTS.map((s) => s.id);
const adaptationIds = ADAPTATIONS.map((a) => a.id);

/** Plain, short, printable — no control characters, no markup. */
const shortText = (max: number) =>
  z.string().trim().max(max).refine((v) => !/[\u0000-\u001f<>]/.test(v), 'Please use plain text.');

export const childProfileSchema = z
  .object({
    pseudonym: shortText(24).pipe(z.string().min(2, 'Give a nickname of at least 2 letters.')),
    year: z.enum(YEARS),
    subjects: z.array(z.enum(subjectIds as [string, ...string[]])).min(1, 'Choose at least one subject.').max(8),
    goals: shortText(160).optional(),
    pathway: z
      .object({
        ks4Start: z.enum(['Y9', 'Y10']).optional(),
        tier: z.enum(['foundation', 'higher']).optional(),
        scienceRoute: z.enum(['combined', 'triple']).optional(),
      })
      .optional(),
    interests: z.array(shortText(24).pipe(z.string().min(1))).max(5),
    adaptations: z.array(z.enum(adaptationIds as [string, ...string[]])).max(adaptationIds.length),
    includePshe: z.boolean(),
  })
  .transform((p): ChildProfile => ({
    ...p,
    goals: p.goals || undefined,
    // A pathway only means something from Year 9.
    pathway: isGcseYear(p.year) ? p.pathway : undefined,
    subjects: Array.from(new Set(p.subjects)),
    interests: Array.from(new Set(p.interests)),
  }));

/** Reads the form's fields into the shape the schema checks. */
export function profileFromForm(form: FormData): unknown {
  const all = (name: string) => form.getAll(name).map(String).filter(Boolean);
  const pick = (name: string) => {
    const v = String(form.get(name) ?? '');
    return v && v !== 'unsure' ? v : undefined;
  };
  return {
    pseudonym: String(form.get('pseudonym') ?? ''),
    year: String(form.get('year') ?? ''),
    subjects: all('subjects'),
    goals: String(form.get('goals') ?? ''),
    pathway: { ks4Start: pick('ks4Start'), tier: pick('tier'), scienceRoute: pick('scienceRoute') },
    interests: String(form.get('interests') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    adaptations: all('adaptations'),
    includePshe: form.get('includePshe') === 'on',
  };
}

export type ChildRecord = { id: string; status: 'active' | 'paused'; createdAt: Date; lastActiveAt: Date; profile: ChildProfile };

export function keyOf(row: Pick<ChildProfileRow, 'id' | 'wrappedKey'>): ChildKey {
  return { profileId: row.id, dek: unwrapKey(row.id, row.wrappedKey) };
}

function decode(row: ChildProfileRow): ChildRecord {
  return { id: row.id, status: row.status, createdAt: row.createdAt, lastActiveAt: row.lastActiveAt, profile: openJson<ChildProfile>(keyOf(row), 'profile', row.data) };
}

export async function listChildren(parentUserId: string): Promise<ChildRecord[]> {
  const rows = await db.select().from(childProfiles).where(eq(childProfiles.parentUserId, parentUserId)).orderBy(childProfiles.createdAt);
  return rows.map(decode);
}

/** One child, only for its own parent. */
export async function getChildRow(parentUserId: string, id: string): Promise<ChildProfileRow | null> {
  const [row] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.parentUserId, parentUserId)))
    .limit(1);
  return row ?? null;
}

export async function getChild(parentUserId: string, id: string): Promise<ChildRecord | null> {
  const row = await getChildRow(parentUserId, id);
  return row ? decode(row) : null;
}

/** Consent kinds recorded for a profile: the profile itself, and PSHE when chosen. */
async function recordConsents(tx: Pick<typeof db, 'insert' | 'update'>, userId: string, childId: string, profile: ChildProfile, before?: ChildProfile) {
  if (!before) {
    await tx.insert(consents).values({ userId, childProfileId: childId, kind: 'child_profile', textVersion: CONSENT_TEXT_VERSION });
  }
  if (profile.includePshe && !before?.includePshe) {
    await tx.insert(consents).values({ userId, childProfileId: childId, kind: 'pshe', textVersion: CONSENT_TEXT_VERSION });
  }
  if (!profile.includePshe && before?.includePshe) {
    await tx
      .update(consents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(consents.childProfileId, childId), eq(consents.kind, 'pshe'), isNull(consents.withdrawnAt)));
  }
}

export async function createChild(parentUserId: string, teamId: string, profile: ChildProfile): Promise<string> {
  const id = crypto.randomUUID();
  const { wrapped, keyVersion } = newWrappedKey(id);
  const data = sealJson({ profileId: id, dek: unwrapKey(id, wrapped) }, 'profile', profile);
  await db.transaction(async (tx) => {
    await tx.insert(childProfiles).values({ id, parentUserId, teamId, keyVersion, wrappedKey: wrapped, data });
    await recordConsents(tx, parentUserId, id, profile);
  });
  return id;
}

export async function updateChild(parentUserId: string, id: string, profile: ChildProfile): Promise<boolean> {
  const row = await getChildRow(parentUserId, id);
  if (!row) return false;
  const before = decode(row).profile;
  await db.transaction(async (tx) => {
    await tx.update(childProfiles).set({ data: sealJson(keyOf(row), 'profile', profile), updatedAt: new Date() }).where(eq(childProfiles.id, id));
    await recordConsents(tx, parentUserId, id, profile, before);
  });
  return true;
}

/**
 * Deletes the profile and, with it, the child's data key — everything sealed
 * with that key (plan, chats) becomes unreadable at once; the rows that
 * reference the profile go by cascade.
 */
export async function deleteChild(parentUserId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(childProfiles)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.parentUserId, parentUserId)))
    .returning({ id: childProfiles.id });
  return deleted.length > 0;
}
