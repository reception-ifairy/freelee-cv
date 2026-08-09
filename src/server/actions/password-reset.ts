'use server';

import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { passwordResetTokens, users } from '@/db/schema';
import { sendEmail } from '@/lib/email/send';
import { getSettingString } from '@/lib/settings';
import type { ActionState } from './auth';

const TOKEN_TTL_MINUTES = 60;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

function resetUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3015').replace(/\/$/, '');
  return `${base}/reset-password?token=${token}`;
}

/**
 * Starts a reset.
 *
 * **Always reports success**, whether or not the address exists. Saying "no
 * account with that email" turns this form into a way to enumerate who has an
 * account, which matters more than the small convenience of a precise error.
 */
export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(Object.fromEntries(formData));
  const generic = { success: 'If that address has an account, a reset link is on its way. It expires in an hour.' };
  if (!parsed.success) return { error: 'Enter a valid email address.' };

  const email = parsed.data.email.toLowerCase();
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return generic;

  const token = randomBytes(32).toString('hex');
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
  });

  const siteName = await getSettingString('site_name', 'Freelee');
  await sendEmail({
    to: email,
    subject: `Reset your ${siteName} password`,
    text:
      `Hello${user.name ? ` ${user.name}` : ''},\n\n` +
      `Someone asked to reset the password for your ${siteName} account.\n\n` +
      `${resetUrl(token)}\n\n` +
      `This link works once and expires in ${TOKEN_TTL_MINUTES} minutes.\n\n` +
      `If it wasn't you, ignore this email — nothing has changed.\n`,
  });

  return generic;
}

const completeSchema = z
  .object({
    token: z.string().min(32),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Those passwords do not match.' });

export async function completePasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hash(parsed.data.token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  // One message for expired, already-used and never-existed. Distinguishing
  // them would tell someone holding a stolen link which case they're in.
  if (!row) return { error: 'That link has expired or already been used. Request a new one.' };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    // Every other outstanding link for this user dies too — if the request was
    // made because of a suspected compromise, leaving spares alive defeats it.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
  });

  return { success: 'Password updated. You can sign in now.' };
}
