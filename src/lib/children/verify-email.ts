import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { sendEmail } from '@/lib/email/send';
import { getSettingString } from '@/lib/settings';

/**
 * Email verification for parent accounts (docs/54). A child profile can be
 * created only from a verified address: the owner's chosen check that the
 * account belongs to a reachable adult ("declaration + email", 2026-11-12;
 * a card check joins when payments go live).
 *
 * Tokens live in the Auth.js `verification_tokens` table, hashed, keyed
 * `verify-email:<userId>`, valid 48 hours. Without a Resend key the email is
 * printed to the server log instead of sent (src/lib/email/send.ts).
 */

const TTL_HOURS = 48;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const identifier = (userId: string) => `verify-email:${userId}`;

export async function sendVerificationEmail(user: { id: string; email: string; name?: string | null }): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier(user.id)));
  await db.insert(verificationTokens).values({ identifier: identifier(user.id), token: hash(token), expires: new Date(Date.now() + TTL_HOURS * 3_600_000) });
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3015').replace(/\/$/, '');
  const siteName = await getSettingString('site_name', 'Freelee');
  await sendEmail({
    to: user.email,
    subject: `Confirm your email for ${siteName}`,
    text:
      `Hello${user.name ? ` ${user.name}` : ''},\n\n` +
      `Please confirm this email address to finish setting up your ${siteName} account. ` +
      `You need a confirmed address before you can add a child's learning profile.\n\n` +
      `${base}/verify-email?token=${token}&u=${encodeURIComponent(user.id)}\n\n` +
      `The link works for ${TTL_HOURS} hours. If you did not create an account, ignore this email.\n`,
  });
}

/** True when the token matched and the address is now verified. */
export async function confirmEmail(userId: string, token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier(userId)), eq(verificationTokens.token, hash(token)), gt(verificationTokens.expires, new Date())))
    .limit(1);
  if (!row) return false;
  await db.update(users).set({ emailVerified: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier(userId)));
  return true;
}
