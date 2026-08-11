import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, desc, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { crews, crewMembers, crewRuns, personas } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { startCrewRunAction } from '@/modules/crews/actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea, Hint } from '@/components/ui/field';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Crew' };

const STATUS_TONE = {
  queued: 'slate', running: 'amber', completed: 'green',
  failed: 'rose', budget_exceeded: 'rose', max_turns_reached: 'amber',
} as const;

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: crewId } = await params;
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  if (!(await isModuleEnabledForTeam(teamId, 'crews'))) notFound();

  const [crew] = await db.select().from(crews).where(and(eq(crews.id, crewId), eq(crews.teamId, teamId))).limit(1);
  if (!crew) notFound();

  const [members, runs] = await Promise.all([
    db
      .select({ member: crewMembers, persona: personas })
      .from(crewMembers)
      .innerJoin(personas, eq(personas.id, crewMembers.personaId))
      .where(eq(crewMembers.crewId, crewId))
      .orderBy(asc(crewMembers.position)),
    db.select().from(crewRuns).where(eq(crewRuns.crewId, crewId)).orderBy(desc(crewRuns.createdAt)).limit(20),
  ]);

  return (
    <div className="container-app py-10">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{crew.name}</h1>
        <Badge tone="brand">{crew.mode}</Badge>
        {!crew.isActive ? <Badge tone="rose">disabled</Badge> : null}
      </div>
      {crew.description ? <p className="mt-1 text-slate-500 dark:text-slate-400">{crew.description}</p> : null}
      <p className="mt-1 text-xs text-slate-400">
        Budget: {crew.budgetCredits} credits · Max turns: {crew.maxTurns}
        {crew.stopConditions.length > 0 ? ` · Stops on: ${crew.stopConditions.join(', ')}` : ''}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Start a run</h2>
            <form action={startCrewRunAction} className="space-y-3">
              <input type="hidden" name="crewId" value={crewId} />
              <Textarea name="input" rows={3} required placeholder="Describe the task for this crew…" />
              <Hint>
                Runs synchronously — this page waits until the crew finishes (or hits its turn/budget cap) before
                redirecting to the run.
              </Hint>
              <button
                type="submit"
                className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-on-brand hover:bg-brand-700"
              >
                Run crew
              </button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Past runs</h2>
            {runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No runs yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    href={`/crews/runs/${run.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{run.input}</p>
                      <p className="text-xs text-slate-400">
                        {run.turnCount} turns · {run.creditsSpent} credits · {relativeTime(run.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[run.status]} className="shrink-0">{run.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Members (turn order)</h2>
          <div className="space-y-2">
            {members.map(({ member, persona }) => (
              <div key={member.id} className="flex items-center gap-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-on-brand">
                  {member.position + 1}
                </span>
                <span className="truncate">{persona.name}</span>
                {member.isSupervisor ? <Badge tone="green" className="ml-auto shrink-0">supervisor</Badge> : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
