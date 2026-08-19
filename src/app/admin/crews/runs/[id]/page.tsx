import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Coins, Repeat, Timer } from 'lucide-react';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { personas, conversationMessages } from '@/db/schema';
import { crews, crewRuns, crewRunSteps } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/stat-tile';
import { Meter } from '@/components/ui/meter';
import { EmptyState } from '@/components/ui/empty-state';
import { jobForCrewRun } from '@/lib/jobs/queue';
import { RunTranscript } from './run-transcript';
import { RunControls } from './run-controls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Run' };

const RUN_TONE: Record<string, 'green' | 'amber' | 'rose' | 'slate' | 'brand'> = {
  completed: 'green', running: 'amber', queued: 'slate', failed: 'rose',
  budget_exceeded: 'rose', max_turns_reached: 'amber', cancelled: 'slate',
};

const TERMINAL = ['completed', 'failed', 'budget_exceeded', 'max_turns_reached', 'cancelled'];

export default async function AdminCrewRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [run] = await db.select().from(crewRuns).where(eq(crewRuns.id, id)).limit(1);
  if (!run) notFound();

  const [[crew], steps, messages, job] = await Promise.all([
    db.select().from(crews).where(eq(crews.id, run.crewId)).limit(1),
    // `crew_run_steps` — written on every step since crews shipped, and read
    // by nothing until now. Per-step credits, errors and timings all existed;
    // there was simply no screen for them.
    db.select().from(crewRunSteps).where(eq(crewRunSteps.crewRunId, id)).orderBy(asc(crewRunSteps.position)),
    db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, run.conversationId))
      .orderBy(asc(conversationMessages.position)),
    jobForCrewRun(id),
  ]);

  const personaIds = [...new Set(steps.map((s) => s.personaId))];
  const stepPersonas = personaIds.length
    ? await db.select({ id: personas.id, name: personas.name, accentColor: personas.accentColor })
        .from(personas).where(inArray(personas.id, personaIds))
    : [];

  const nameOf = (personaId: number) => stepPersonas.find((p) => p.id === personaId)?.name ?? `Persona ${personaId}`;
  const live = !TERMINAL.includes(run.status);
  const slowest = Math.max(1, ...steps.map((s) => duration(s.startedAt, s.completedAt)));

  return (
    <div>
      <PageHeader
        title={crew?.name ? `${crew.name} — run` : 'Run'}
        description={run.input}
        actions={
          <>
            <RunControls runId={run.id} live={live} cancellable={Boolean(job && ['queued', 'running'].includes(job.status))} />
            <Link
              href={crew ? `/admin/crews/${crew.id}` : '/admin/crews'}
              className="inline-flex h-10 items-center gap-2 rounded-control border hairline px-4 text-sm font-semibold"
            >
              <ArrowLeft className="size-4" /> Team
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md">
          <p className="eyebrow">Status</p>
          <p className="mt-2 flex items-center gap-2">
            <Badge tone={RUN_TONE[run.status] ?? 'slate'}>{run.status.replace(/_/g, ' ')}</Badge>
          </p>
          {run.stopReason ? (
            <p className="mt-1.5 text-xs text-slate-500">Stopped: {run.stopReason.replace(/_/g, ' ')}</p>
          ) : null}
        </Card>
        <StatTile label="Turns" icon={Repeat} value={`${run.turnCount} / ${run.maxTurns}`} />
        <StatTile label="Credits" icon={Coins} value={`${run.creditsSpent} / ${run.budgetCredits}`} />
        <StatTile
          label="Elapsed"
          icon={Timer}
          value={run.startedAt ? formatMs(duration(run.startedAt, run.completedAt ?? new Date())) : '—'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padding="md">
          <h2 className="font-semibold">Steps</h2>
          <p className="mt-1 text-xs text-slate-500">
            Who acted, what it cost and how long it took. Recorded since crews shipped; this is the
            first screen to read it.
          </p>

          {steps.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title={live ? 'Waiting to start' : 'No steps recorded'}
              description={live ? 'The first step appears as soon as the worker picks this run up.' : 'This run ended before any member acted.'}
              className="mt-4 border-0 py-8"
            />
          ) : (
            <ol className="mt-4 space-y-2">
              {steps.map((step) => {
                const ms = duration(step.startedAt, step.completedAt);
                return (
                  <li key={step.id} className="rounded-control border hairline p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mono text-[11px]">
                        {step.position}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(step.personaId)}</span>
                      <Badge tone={step.status === 'failed' ? 'rose' : 'green'}>{step.status}</Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-slate-500">Cost</span>
                        <span className="font-medium tabular-nums">{step.creditsCost}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-slate-500">Time</span>
                        {/* Scaled against the slowest step, so a stall stands out
                            without reading every number. */}
                        <Meter value={ms} max={slowest} display={formatMs(ms)} label="Step duration" />
                      </span>
                    </div>

                    {step.error ? (
                      <p className="mt-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-400">{step.error}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <RunTranscript messages={messages.map((m) => ({
          id: m.id,
          authorType: m.authorType,
          content: m.content,
          error: m.error,
          speaker: m.authorType === 'persona' ? nameOf(Number(m.authorId)) : 'You',
        }))} />
      </div>
    </div>
  );
}

/** Negative durations were a real bug — see docs/46. Clamped so a legacy row cannot render nonsense. */
function duration(from: Date | null, to: Date | null): number {
  if (!from || !to) return 0;
  return Math.max(0, to.getTime() - from.getTime());
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
