import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles, type ChildProfileRow } from '@/db/schema';
import { openJson, type ChildKey } from '@/lib/crypto/envelope';
import { keyOf } from './store';
import { buildPlan, loadPlan, savePlan, type Plan } from './plan';
import type { ChildProfile } from './profile';

/**
 * Child mode (docs/54): the parent picks a child and hands over the device.
 * A signed cookie names the active profile; while it is set the site shows
 * only /learn and the child's lessons (src/proxy.ts), and leaving needs the
 * parent's password. The child never has a login of their own.
 *
 * The cookie holds the profile id and an HMAC over parent id + profile id with
 * AUTH_SECRET — it cannot be moved to another account or forged, and it says
 * nothing about the child.
 */

export const CHILD_COOKIE = 'freelee_child';

function sign(parentId: string, profileId: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET ?? '').update(`child-mode:${parentId}:${profileId}`).digest('base64url');
}

export async function enterChildMode(parentId: string, profileId: string): Promise<void> {
  (await cookies()).set(CHILD_COOKIE, `${profileId}.${sign(parentId, profileId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 3600,
  });
}

export async function leaveChildMode(): Promise<void> {
  (await cookies()).delete(CHILD_COOKIE);
}

/** The active child's profile id for this parent, or null (no cookie, or a cookie that is not theirs). */
export async function activeChildId(parentId: string): Promise<string | null> {
  const raw = (await cookies()).get(CHILD_COOKIE)?.value ?? '';
  const [profileId, mac] = raw.split('.');
  if (!profileId || !mac) return null;
  const expected = Buffer.from(sign(parentId, profileId));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? profileId : null;
}

export type ChildContext = { row: ChildProfileRow; key: ChildKey; profile: ChildProfile };

/** A child profile with its key, only for its own parent. */
export async function childContext(parentId: string, profileId: string): Promise<ChildContext | null> {
  const [row] = await db.select().from(childProfiles).where(eq(childProfiles.id, profileId)).limit(1);
  if (!row || row.parentUserId !== parentId) return null;
  const key = keyOf(row);
  return { row, key, profile: openJson<ChildProfile>(key, 'profile', row.data) };
}

/**
 * The child's plan, building it when there is none yet (the curriculum may have
 * been unreachable when the profile was saved). Null when it cannot be built now.
 */
export async function ensurePlan(ctx: ChildContext, options: { rebuild?: boolean } = {}): Promise<{ plan: Plan | null; error?: string }> {
  const existing = await loadPlan(ctx.row, ctx.key);
  if (existing && !options.rebuild) return { plan: existing };
  const built = await buildPlan(ctx.profile, existing);
  if (!built.ok) return { plan: existing, error: built.error };
  await savePlan(ctx.row, ctx.key, built.plan);
  return { plan: built.plan };
}
