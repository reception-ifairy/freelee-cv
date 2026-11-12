'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { consents, users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { childFeaturesAvailable } from '@/lib/crypto/envelope';
import { childProfileSchema, createChild, deleteChild, profileFromForm, updateChild } from '@/lib/children/store';
import { sendVerificationEmail } from '@/lib/children/verify-email';
import { CONSENT_TEXT_VERSION } from '@/lib/children/profile';
import type { ActionState } from './auth';

/**
 * Parent-side actions on child profiles (docs/54). Only the signed-in parent
 * can touch their own children; every store call filters by parent id.
 */

async function parentOrError(): Promise<{ user: Awaited<ReturnType<typeof requireUser>>; error?: string }> {
  const user = await requireUser();
  if (!childFeaturesAvailable()) return { user, error: 'Child profiles are not available on this server yet. Please try again later.' };
  const [row] = await db.select({ emailVerified: users.emailVerified, adult: users.adultDeclaredAt }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row?.emailVerified) return { user, error: 'Please confirm your email address first — use the link we sent you.' };
  if (!row.adult) return { user, error: 'Please confirm you are 18 or over and a parent or guardian (below) first.' };
  return { user };
}

export async function saveChildAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error } = await parentOrError();
  if (error) return { error };
  const parsed = childProfileSchema.safeParse(profileFromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  if (formData.get('consent') !== 'on' && !formData.get('id')) {
    return { error: 'Please confirm that you are this child’s parent or guardian and agree to how the profile is used.' };
  }

  const id = String(formData.get('id') ?? '');
  if (id) {
    if (!(await updateChild(user.id, id, parsed.data))) return { error: 'That profile was not found.' };
  } else {
    await createChild(user.id, user.defaultTeamId, parsed.data);
  }
  revalidatePath('/dashboard/children');
  return { success: id ? 'Profile saved.' : `Profile for ${parsed.data.pseudonym} created.` };
}

export async function deleteChildAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (formData.get('confirm') !== 'on') return;
  await deleteChild(user.id, id);
  revalidatePath('/dashboard/children');
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await requireUser();
  const [row] = await db.select({ email: users.email, name: users.name, emailVerified: users.emailVerified }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row) return { error: 'Account not found.' };
  if (row.emailVerified) return { success: 'Your email is already confirmed.' };
  await sendVerificationEmail({ id: user.id, email: row.email, name: row.name });
  return { success: 'A new confirmation link is on its way.' };
}

/** For accounts created before the adult declaration existed (docs/54). */
export async function declareAdultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (formData.get('adult') !== 'on') return { error: 'Please tick the box to confirm.' };
  await db.update(users).set({ adultDeclaredAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.insert(consents).values({ userId: user.id, kind: 'adult_declaration', textVersion: CONSENT_TEXT_VERSION });
  revalidatePath('/dashboard/children');
  return { success: 'Thank you.' };
}
