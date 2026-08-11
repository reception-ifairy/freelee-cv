import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { crewRuns, crews, conversationParticipants, conversationMessages } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertRunAccess } from '@/modules/crews/actions';
import { RoomLive } from '@/modules/group-chat/components/room-live';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { initialsOf, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Crew run' };

const STATUS_TONE = {
  queued: 'slate', running: 'amber', completed: 'green',
  failed: 'rose', budget_exceeded: 'rose', max_turns_reached: 'amber',
} as const;

/**
 * Reuses group-chat's SSE endpoint (/api/rooms/[id]/stream) and <RoomLive>
 * unmodified — a crew run's conversation is an ordinary `conversations` row
 * (kind='crew_run'), and that route only checks conversation_participants,
 * never group-chat's own module-enabled flag. See docs/14-crews.md.
 */
export default async function CrewRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const user = await requireUser();

  const [run] = await db.select().from(crewRuns).where(eq(crewRuns.id, runId)).limit(1);
  if (!run) notFound();

  try {
    await assertRunAccess(runId, user.id);
  } catch {
    notFound();
  }

  const [[crew], participants, messages] = await Promise.all([
    db.select().from(crews).where(eq(crews.id, run.crewId)).limit(1),
    db.select().from(conversationParticipants).where(eq(conversationParticipants.conversationId, run.conversationId)),
    db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, run.conversationId))
      .orderBy(asc(conversationMessages.position)),
  ]);

  const participantByKey = new Map(participants.map((p) => [`${p.participantType}:${p.participantId}`, p]));
  const isTerminal = run.status !== 'queued' && run.status !== 'running';

  return (
    <div className="container-app py-8">
      {isTerminal ? null : <RoomLive conversationId={run.conversationId} />}

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/crews/${run.crewId}`} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          ← {crew?.name ?? 'Crew'}
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">Run</h1>
        <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>
        {run.stopReason ? <span className="text-xs text-slate-400">{run.stopReason}</span> : null}
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {run.turnCount}/{run.maxTurns} turns · {run.creditsSpent}/{run.budgetCredits} credits ·{' '}
        started {relativeTime(run.startedAt ?? run.createdAt)}
        {!isTerminal ? ' — updates live' : ''}
      </p>

      <Card className="mt-4 max-h-[65vh] space-y-4 overflow-y-auto p-5">
        {messages.map((message) => {
          const key = `${message.authorType}:${message.authorId ?? ''}`;
          const author = participantByKey.get(key);
          const isPersona = message.authorType === 'persona';

          return (
            <div key={message.id} className="flex items-start gap-3">
              <span
                className={
                  isPersona
                    ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-on-brand'
                    : 'grid size-8 shrink-0 place-items-center rounded-full bg-slate-300 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }
              >
                {initialsOf(author?.displayName ?? '?')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {author?.displayName ?? (isPersona ? 'Persona' : 'Someone')}
                  </span>
                  {isPersona ? <Badge tone="brand">@{author?.mentionHandle}</Badge> : null}
                  <span className="text-xs text-slate-400">{relativeTime(message.createdAt)}</span>
                </div>
                {message.status === 'failed' ? (
                  <p className="mt-1 text-sm text-rose-500">{message.error ?? 'This step failed.'}</p>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
