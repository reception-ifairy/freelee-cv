import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CircleCheck, Play } from 'lucide-react';
import { asc, count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { crewReadiness } from '@/modules/crews/readiness';
import { runOutcome, teamSummary } from '@/modules/crews/labels';
import type { CrewModeValue } from '@/modules/crews/rules';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TeamBuilder } from '@/components/admin/team-builder';
import { relativeTime, cn } from '@/lib/utils';
import { loadTeamBuilderOptions } from '../builder-data';
import { TestRun } from './test-run';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [crew] = await db.select({ name: crews.name }).from(crews).where(eq(crews.id, id)).limit(1);
  return { title: crew?.name ?? 'Bot team' };
}

/**
 * One team, two tabs: **Build** (the team builder) and **Runs** (a test run
 * with its pre-check, then every run so far).
 *
 * This page used to stack a run box, the runs list, a drag board and a
 * separate settings form — four things, two of which saved the same team
 * differently. Tabs are links (`?tab=runs`) rather than client state so a tab
 * survives a reload, can be linked to (the run page's "Back to team" lands on
 * Runs) and only the open tab's queries run.
 */
export default async function AdminCrewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string }>;
}) {
  const { id } = await params;
  const { tab, created } = await searchParams;
  const active = tab === 'runs' ? 'runs' : 'build';

  const [crew] = await db.select().from(crews).where(eq(crews.id, id)).limit(1);
  if (!crew) notFound();

  const [members, [{ runCount }]] = await Promise.all([
    db.select().from(crewMembers).where(eq(crewMembers.crewId, id)).orderBy(asc(crewMembers.position), asc(crewMembers.id)),
    db.select({ runCount: count() }).from(crewRuns).where(eq(crewRuns.crewId, id)),
  ]);

  const base = `/admin/crews/${crew.id}`;
  const tabs = [
    { id: 'build', label: 'Build', href: base },
    { id: 'runs', label: runCount ? `Runs (${runCount})` : 'Runs', href: `${base}?tab=runs` },
  ] as const;

  return (
    <div>
      <Link
        href="/admin/crews"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> Bot teams
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-xl font-bold tracking-tight">{crew.name}</h1>
          {crew.isActive ? null : <Badge tone="slate">Switched off</Badge>}
        </div>
        {crew.description ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{crew.description}</p>
        ) : null}
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {teamSummary({ memberCount: members.length, mode: crew.mode, maxTurns: crew.maxTurns, budgetCredits: crew.budgetCredits })}
        </p>
      </header>

      {created ? (
        <Card className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <CircleCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">Team created. Next, give it a small task to check it works.</p>
          <Link href={`${base}?tab=runs`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Go to Runs →
          </Link>
        </Card>
      ) : null}

      <nav aria-label="Team sections" className="mb-6 flex gap-1 border-b border-slate-200 dark:border-white/10">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active === t.id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
              active === t.id
                ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === 'build' ? (
        <BuildTab crew={crew} members={members} />
      ) : (
        <RunsTab crew={crew} members={members} />
      )}
    </div>
  );
}

type CrewRow = typeof crews.$inferSelect;
type MemberRow = typeof crewMembers.$inferSelect;

async function BuildTab({ crew, members }: { crew: CrewRow; members: MemberRow[] }) {
  const { pool, projects } = await loadTeamBuilderOptions(members.map((m) => m.personaId));

  return (
    <div className="max-w-4xl">
      <TeamBuilder
        team={{
          id: crew.id,
          name: crew.name,
          description: crew.description ?? '',
          mode: crew.mode as CrewModeValue,
          budgetCredits: crew.budgetCredits,
          maxTurns: crew.maxTurns,
          stopConditions: crew.stopConditions.join(', '),
          projectId: crew.projectId ?? '',
          isActive: crew.isActive,
          members: members.map((m) => ({
            personaId: m.personaId,
            instructions: m.instructions ?? '',
            isLead: m.isSupervisor,
          })),
        }}
        pool={pool}
        projects={projects}
      />
    </div>
  );
}

async function RunsTab({ crew, members }: { crew: CrewRow; members: MemberRow[] }) {
  const [readiness, runs] = await Promise.all([
    crewReadiness(crew, members),
    db.select().from(crewRuns).where(eq(crewRuns.crewId, crew.id)).orderBy(desc(crewRuns.createdAt)).limit(25),
  ]);

  return (
    <div className="grid max-w-4xl gap-6">
      <TestRun crewId={crew.id} checks={readiness.checks} ready={readiness.ready} blocker={readiness.blocker} />

      <Card className="p-4 sm:p-5">
        <h2 className="font-semibold">Runs so far</h2>
        {runs.length === 0 ? (
          <EmptyState
            icon={Play}
            title="No runs yet"
            description="Each run keeps a step-by-step record: which bot replied, what it cost and how long it took."
            className="mt-4 border-0 py-8"
          />
        ) : (
          <ul className="mt-3 divide-y hairline">
            {runs.map((run) => {
              const outcome = runOutcome(run.status, run.stopReason);
              return (
                <li key={run.id}>
                  <Link
                    href={`/admin/crews/runs/${run.id}`}
                    className="flex flex-col gap-1.5 py-3 text-sm transition hover:text-brand-500 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{run.input}</span>
                      <span className="block truncate text-xs text-slate-500">{outcome.sentence}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone={outcome.tone}>{outcome.label}</Badge>
                      <span>
                        {run.turnCount} turn{run.turnCount === 1 ? '' : 's'} · {run.creditsSpent} credits
                      </span>
                      <span>{relativeTime(run.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
