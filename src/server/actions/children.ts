'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, childProfiles, consents, users } from '@/db/schema';
import { requireUser, signOut } from '@/lib/auth';
import { childFeaturesAvailable } from '@/lib/crypto/envelope';
import { childProfileSchema, createChild, deleteChild, profileFromForm, updateChild } from '@/lib/children/store';
import { sendVerificationEmail } from '@/lib/children/verify-email';
import { childContext, enterChildMode, ensurePlan, leaveChildMode } from '@/lib/children/child-mode';
import { adaptationsFromNotes } from '@/lib/children/notes';
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

  // "Anything else?": used once to choose adaptations, then dropped — never stored or logged.
  const notes = String(formData.get('notes') ?? '').trim();
  let notesNote = '';
  if (notes) {
    if (formData.get('notesConsent') !== 'on') return { error: 'To use “Anything else?”, please tick the box agreeing to send it once to the AI service — or leave it empty.' };
    try {
      const picked = await adaptationsFromNotes(notes);
      parsed.data.adaptations = Array.from(new Set([...parsed.data.adaptations, ...picked]));
      notesNote = picked.length ? ` ${picked.length} adaptation(s) added from your note; the note itself was not kept.` : ' No adaptations matched your note; it was not kept.';
    } catch {
      return { error: 'Your note could not be processed just now. Nothing was saved — try again, or leave it empty.' };
    }
    await db.insert(consents).values({ userId: user.id, kind: 'notes_once', textVersion: CONSENT_TEXT_VERSION });
  }

  const existingId = String(formData.get('id') ?? '');
  let id = existingId;
  if (existingId) {
    if (!(await updateChild(user.id, existingId, parsed.data))) return { error: 'That profile was not found.' };
  } else {
    id = await createChild(user.id, user.defaultTeamId, parsed.data);
  }
  // The plan is built once, here — year, subjects and GCSE settings go to the curriculum, nothing else.
  // A failure leaves the profile saved; the plan is built on the next try (button, or the first lesson).
  const ctx = await childContext(user.id, id);
  const built = ctx ? await ensurePlan(ctx, { rebuild: true }).catch(() => ({ plan: null, error: 'unreachable' })) : null;
  revalidatePath('/dashboard/children');
  const saved = existingId ? 'Profile saved.' : `Profile for ${parsed.data.pseudonym} created.`;
  return built?.plan
    ? { success: `${saved} Learning plan ready.${notesNote}` }
    : { success: `${saved} The learning plan could not be built just now — use “Build plan” later.${notesNote}` };
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

/** Builds (or refreshes) a child's plan from the curriculum — keeps progress. */
export async function refreshPlanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ctx = await childContext(user.id, String(formData.get('id') ?? ''));
  if (ctx) await ensurePlan(ctx, { rebuild: true }).catch(() => undefined);
  revalidatePath('/dashboard/children');
}

/** Hands the device to the child: child mode for one profile (docs/54). */
export async function startLearningAction(formData: FormData): Promise<void> {
  const { user, error } = await parentOrError();
  if (error) redirect('/dashboard/children');
  const ctx = await childContext(user.id, String(formData.get('id') ?? ''));
  if (!ctx) redirect('/dashboard/children');
  await enterChildMode(user.id, ctx.row.id);
  redirect('/learn');
}

/** Leaving child mode needs the parent's password, so the child cannot wander into the account. */
export async function exitChildModeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  const password = String(formData.get('password') ?? '');
  if (!row?.passwordHash || !(await bcrypt.compare(password, row.passwordHash))) return { error: 'That password is not right.' };
  await leaveChildMode();
  redirect('/dashboard/children');
}

/**
 * Deletes the account (docs/54): every child profile (with its key, plan and
 * lessons), every chat, then the personal details. Billing records stay — the
 * law requires them — under an account with no name, email or password.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [row] = await db.select({ passwordHash: users.passwordHash, isAdmin: users.isAdmin }).from(users).where(eq(users.id, user.id)).limit(1);
  if (row?.isAdmin) return { error: 'A platform admin account cannot be deleted here.' };
  if (formData.get('confirm') !== 'on') return { error: 'Please tick the box to confirm.' };
  if (!row?.passwordHash || !(await bcrypt.compare(String(formData.get('password') ?? ''), row.passwordHash))) return { error: 'That password is not right.' };
  await db.transaction(async (tx) => {
    await tx.delete(childProfiles).where(eq(childProfiles.parentUserId, user.id));
    await tx.delete(chats).where(eq(chats.userId, user.id));
    await tx.delete(consents).where(eq(consents.userId, user.id));
    await tx
      .update(users)
      .set({ name: 'Deleted account', email: `deleted-${user.id}@deleted.invalid`, passwordHash: null, image: null, emailVerified: null, adultDeclaredAt: null, isActive: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  });
  await leaveChildMode();
  await signOut({ redirectTo: '/' });
  return null;
}

