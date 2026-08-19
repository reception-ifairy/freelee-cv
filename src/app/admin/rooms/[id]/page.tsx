import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Coins, MessageSquare, Users } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationParticipants, conversationMessages, teams, projects } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/stat-tile';
import { RunTranscript } from '../../crews/runs/[id]/run-transcript';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Room' };

export default async function AdminRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [room] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      kind: conversations.kind,
      messageCount: conversations.messageCount,
      costTotal: conversations.costTotal,
      teamName: teams.name,
      projectName: projects.name,
    })
    .from(conversations)
    .leftJoin(teams, eq(teams.id, conversations.teamId))
    .leftJoin(projects, eq(projects.id, conversations.projectId))
    .where(eq(conversations.id, id))
    .limit(1);

  if (!room) notFound();

  const [participants, messages] = await Promise.all([
    db.select().from(conversationParticipants).where(eq(conversationParticipants.conversationId, id)),
    db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, id)).orderBy(asc(conversationMessages.position)),
  ]);

  const nameOf = (authorType: string, authorId: string | null) =>
    participants.find((p) => p.participantType === authorType && p.participantId === authorId)?.displayName ??
    (authorType === 'user' ? 'Someone' : 'A persona');

  return (
    <div>
      <PageHeader
        title={room.title ?? 'Untitled room'}
        description={`${room.teamName ?? 'Unknown team'}${room.projectName ? ` · ${room.projectName}` : ''}`}
        actions={
          <Link href="/admin/rooms" className="inline-flex h-10 items-center gap-2 rounded-control border hairline px-4 text-sm font-semibold">
            <ArrowLeft className="size-4" /> Rooms
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Messages" icon={MessageSquare} value={String(room.messageCount)} />
        <StatTile label="Participants" icon={Users} value={String(participants.length)} />
        <StatTile label="Credits" icon={Coins} value={String(room.costTotal)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RunTranscript
            messages={messages.map((m) => ({
              id: m.id,
              authorType: m.authorType,
              content: m.content,
              error: m.error,
              speaker: nameOf(m.authorType, m.authorId),
            }))}
          />
        </div>

        <Card padding="md">
          <h2 className="font-semibold">Participants</h2>
          <ul className="mt-4 space-y-2">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{participant.displayName}</span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">@{participant.mentionHandle}</span>
                <Badge tone={participant.participantType === 'persona' ? 'brand' : 'slate'}>
                  {participant.participantType}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
