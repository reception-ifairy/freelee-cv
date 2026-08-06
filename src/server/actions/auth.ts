'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, teams, teamMembers } from '@/db/schema';
import { signIn, signOut } from '@/lib/auth';
import { grantCredits } from '@/lib/billing/credits';
import { getSettingInt } from '@/lib/settings';

export type ActionState = { error?: string; success?: string } | null;

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your name.').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[a-zA-Z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirm: z.string(),
    terms: z.literal('on', { message: 'You must accept the terms.' }),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'An account with that email already exists.' };

  const passwordHash = await bcrypt.hash(password, 12);

  // A brand-new user and their personal team are created in one transaction,
  // each referencing the other's not-yet-committed id — this only works
  // because the users<->teams FK pair is DEFERRABLE INITIALLY DEFERRED (see
  // drizzle/0006_teams_not_null.sql); Postgres checks both FKs at COMMIT,
  // not per-statement. "A team of one," not a special case — see the
  // comment above the `teams` table in src/db/schema.ts.
  const [user] = await db.transaction(async (tx) => {
    const userId = crypto.randomUUID();
    const teamId = crypto.randomUUID();

    const inserted = await tx
      .insert(users)
      .values({ id: userId, name, email, passwordHash, defaultTeamId: teamId })
      .returning();

    await tx.insert(teams).values({
      id: teamId,
      name: `${name}’s workspace`,
      slug: `user-${userId.slice(0, 8)}`,
      ownerId: userId,
    });

    await tx.insert(teamMembers).values({ teamId, userId, role: 'owner' });

    return inserted;
  });

  const bonus = await getSettingInt('signup_bonus_credits', Number(process.env.SIGNUP_BONUS_CREDITS ?? 250));
  if (bonus > 0) {
    await grantCredits(user.id, bonus, { type: 'bonus', description: 'Welcome bonus' });
  }

  // signIn redirects internally, which throws — nothing after this runs.
  await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  return null;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  redirectTo: z.string().optional(),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.redirectTo || '/dashboard',
    });
  } catch (error) {
    // Never reveal whether the email or the password was wrong.
    if (error instanceof AuthError) return { error: 'Those credentials do not match our records.' };
    throw error; // redirect() throws internally — it must bubble up
  }

  return null;
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect('/');
}
