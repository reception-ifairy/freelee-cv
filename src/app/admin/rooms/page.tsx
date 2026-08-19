import type { Metadata } from 'next';
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationParticipants, projects, teams } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Meter } from '@/components/ui/meter';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rooms' };

/**
 * Every conversation on the platform, across teams.
 *
 * Includes `crew_run` conversations, clearly labelled. The user-facing
 * `/rooms` list deliberately does *not* — it filters to `kind: 'room'`,
 * because a finished crew run appearing there as an ordinary room let anyone
 * post into it after the fact. Here the whole picture is the point.
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
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  const topCost = Math.max(1, ...rows.map((r) => r.costTotal));

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Every multi-participant conversation on the platform, including bot-team runs."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No rooms yet"
          description="A room is a conversation several people and personas share, where an @mention asks a persona to reply. Bot-team runs appear here too."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y hairline">
            {rows.map((room) => (
              <li key={room.id}>
                <Link href={`/admin/rooms/${room.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-white/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{room.title ?? 'Untitled'}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {room.teamName ?? 'Unknown team'}
                      {room.projectName ? ` · ${room.projectName}` : ''}
                      {' · '}{room.participants} participant{room.participants === 1 ? '' : 's'}
                    </span>
                  </span>

                  <Badge tone={room.kind === 'crew_run' ? 'brand' : room.kind === 'playground' ? 'amber' : 'slate'}>
                    {room.kind === 'crew_run' ? 'Team run' : room.kind === 'playground' ? 'Playground' : 'Room'}
                  </Badge>

                  <span className="hidden w-32 shrink-0 sm:block">
                    <Meter value={room.costTotal} max={topCost} display={`${room.costTotal}c`} label="Credits" />
                  </span>

                  <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">{room.messageCount} msg</span>
                  <span className="w-24 shrink-0 text-right text-xs text-slate-500">{relativeTime(room.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
