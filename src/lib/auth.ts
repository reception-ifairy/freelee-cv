import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { User } from 'next-auth';
import { db } from '@/db';
import { users, teamMembers, type TeamMember } from '@/db/schema';
import { hasPermission, type TeamPermission } from '@/lib/permissions';
import { authConfig } from './auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw: Partial<Record<string, unknown>>): Promise<User | null> {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);

        // Suspended accounts and OAuth-only accounts have no usable password.
        if (!user || !user.isActive || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          isAdmin: user.isAdmin,
          defaultTeamId: user.defaultTeamId,
        };
      },
    }),
  ],
  callbacks: authConfig.callbacks,
});

/** Throws rather than returning null, so a caller cannot forget the check. */
/**
 * Self-heals `session.user.defaultTeamId` when it's missing — happens on a
 * JWT session cookie issued before this field existed on the token (JWT
 * strategy never re-fetches from the DB after initial sign-in, so an old
 * cookie just keeps decoding to `undefined` forever). Every downstream
 * consumer (getBalanceForTeam, isModuleEnabledForTeam, ...) passes this
 * straight into a drizzle `eq()`, which throws `UNDEFINED_VALUE` — not a
 * soft null-safe query — so this was crashing every page for an affected
 * session (src/components/site/header.tsx renders on all of them). Fixed at
 * the source here rather than defensively guarding every call site.
 */
async function ensureDefaultTeamId<T extends { id: string; defaultTeamId: string }>(user: T): Promise<T> {
  if (user.defaultTeamId) return user;

  const [row] = await db.select({ defaultTeamId: users.defaultTeamId }).from(users).where(eq(users.id, user.id)).limit(1);
  if (row?.defaultTeamId) user.defaultTeamId = row.defaultTeamId;
  return user;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  return ensureDefaultTeamId(session.user);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('FORBIDDEN');
  return user;
}

export async function currentUser() {
  const session = await auth();
  if (!session?.user) return null;
  return ensureDefaultTeamId(session.user);
}

/* ============================ Team authorization ==========================
 * Second of the three authorization levels (platform / team / resource — see
 * docs/09-team-authorization.md). `requireAdmin()` above is the platform
 * level and is unrelated to team roles; a platform admin is not automatically
 * a member of every team and still goes through these checks for team
 * actions.
 * ------------------------------------------------------------------------- */

/** Throws if the signed-in user isn't a member of `teamId`. Returns their membership row. */
export async function requireTeamMember(teamId: string): Promise<TeamMember> {
  const user = await requireUser();

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
    .limit(1);

  if (!member) throw new Error('FORBIDDEN');
  return member;
}

export async function requireTeamRole(teamId: string, roles: TeamMember['role'][]): Promise<TeamMember> {
  const member = await requireTeamMember(teamId);
  if (!roles.includes(member.role)) throw new Error('FORBIDDEN');
  return member;
}

export async function requireTeamPermission(teamId: string, permission: TeamPermission): Promise<TeamMember> {
  const member = await requireTeamMember(teamId);
  if (!hasPermission(member, permission)) throw new Error('FORBIDDEN');
  return member;
}
