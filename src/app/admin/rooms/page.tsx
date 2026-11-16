import type { Metadata } from 'next';
import { desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationParticipants, projects, teams } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { relativeTime } from '@/lib/utils';
import { RoomsList } from './rooms-list';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rooms' };

/**
 * Every room on the platform, across teams.
 *
 * Bot-team runs used to be listed here too, as "Team run" rows between the
 * rooms. They are conversations underneath, but nobody looks for a run in
 * Rooms: a run belongs to its team, and the team page's Runs tab lists them
 * with what each one cost and how it ended. So `crew_run` is filtered out
 * here, the same way the user-facing `/rooms` list has always done (there for
 * a sharper reason — a finished run listed as a room could be posted into).
 * A run's transcript is still reachable at `/admin/rooms/<id>` by link.
 */
export default async function AdminRoomsPage() {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      messageCount: conversations.messageCount,
      costTotal: conversations.costTotal,
      lastMessageAt: conversations.lastMessageAt,
      teamName: teams.name,
      projectName: projects.name,
      participants: sql<number>`(select count(*)::int from ${conversationParticipants}
                                 where ${conversationParticipants.conversationId} = ${sql.raw('"conversations"."id"')})`,
    })
    .from(conversations)
    .leftJoin(teams, eq(teams.id, conversations.teamId))
    .leftJoin(projects, eq(projects.id, conversations.projectId))
    .where(ne(conversations.kind, 'crew_run'))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Every group conversation on the platform. Bot-team runs are on each team's Runs tab."
      />

      <RoomsList
        rows={rows.map((room) => ({
          id: room.id,
          title: room.title ?? 'Untitled',
          kind: room.kind,
          team: room.teamName ?? 'Unknown team',
          project: room.projectName,
          participants: room.participants,
          messages: room.messageCount,
          cost: room.costTotal,
          last: relativeTime(room.lastMessageAt),
        }))}
      />
    </div>
  );
}
