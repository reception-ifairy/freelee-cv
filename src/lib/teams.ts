import 'server-only';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db';
import { teams, users } from '@/db/schema';

/**
 * The team created for the pre-existing single owner during the teams
 * retrofit (drizzle/0005 + 0006, backfilled per docs/06-operations.md's
 * pattern). Until Phase 2 adds real per-team creation surfaces, this is
 * where admin-created personas and guest/anonymous chats are attributed —
 * the platform's own catalog is still, in effect, one team's catalog.
 * Cached per request like src/lib/settings.ts's getSetting* helpers.
 */
export const getPlatformTeamId = cache(async (): Promise<string> => {
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, 'platform')).limit(1);
  if (!team) {
    throw new Error('Platform team not found — has the teams backfill (drizzle/0005 + 0006) run?');
  }
  return team.id;
});

/** Which team a chat belongs to: the signed-in user's own team, or (guests) the platform team. */
export async function resolveChatTeamId(userId: string | null | undefined): Promise<string> {
  if (!userId) return getPlatformTeamId();

  const [row] = await db.select({ teamId: users.defaultTeamId }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.teamId ?? getPlatformTeamId();
}
