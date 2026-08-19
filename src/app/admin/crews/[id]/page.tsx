import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bot, Play } from 'lucide-react';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { personas, projects, sectors } from '@/db/schema';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea, Label, Hint } from '@/components/ui/field';
import { relativeTime } from '@/lib/utils';
import { startAdminCrewRunAction } from '@/server/actions/admin-crews';
import { TeamAssign } from '@/components/admin/team-assign';
import { CrewSettings } from './crew-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [crew] = await db.select({ name: crews.name }).from(crews).where(eq(crews.id, id)).limit(1);
  return { title: crew?.name ?? 'Bot team' };
}

const RUN_TONE: Record<string, 'green' | 'amber' | 'rose' | 'slate' | 'brand'> = {
  completed: 'green', running: 'amber', queued: 'slate', failed: 'rose',
  budget_exceeded: 'rose', max_turns_reached: 'amber', cancelled: 'slate',
};

export default async function AdminCrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [crew] = await db.select().from(crews).where(eq(crews.id, id)).limit(1);
  if (!crew) notFound();

  const [members, runs, allPersonas, projectRows] = await Promise.all([
    db.select().from(crewMembers).where(eq(crewMembers.crewId, id)).orderBy(asc(crewMembers.position)),
    db.select().from(crewRuns).where(eq(crewRuns.crewId, id)).orderBy(desc(crewRuns.createdAt)).limit(15),
    db
      .select({
        id: personas.id,
        slug: personas.slug,
        name: personas.name,
        expertise: personas.expertise,
        accentColor: personas.accentColor,
        sectorSlug: sectors.slug,
        sectorName: sectors.name,
        categoryId: sql<number | null>`(select c.id from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categorySlug: sql<string | null>`(select c.slug from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categoryColor: sql<string | null>`(select c.color from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categoryName: sql<string | null>`(select c.name from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
      })
      .from(personas)
      .leftJoin(sectors, eq(sectors.id, personas.sectorId))
      .where(eq(personas.isActive, true))
      .orderBy(asc(personas.name)),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
  ]);

  const memberPersonas = members.length
    ? await db.select({ id: personas.id, name: personas.name }).from(personas).where(inArray(personas.id, members.map((m) => m.personaId)))
    : [];


  return (
    <div>
      <PageHeader
        title={crew.name}
        description={crew.description ?? `${crew.mode} · ${crew.maxTurns} turns · ${crew.budgetCredits} credits`}
        actions={
          <Link href="/admin/crews" className="inline-flex h-10 items-center gap-2 rounded-control border hairline px-4 text-sm font-semibold">
            <ArrowLeft className="size-4" /> Bot teams
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <InlineForm action={startAdminCrewRunAction} title="Start a run" submitLabel="Start run">
            <input type="hidden" name="crewId" value={crew.id} />
            <div>
              <Label htmlFor="input">What should the team work on?</Label>
              <Textarea id="input" name="input" rows={3} required placeholder="Describe the task…" />
              <Hint>
                Runs in the background — this page hands off to the run view, which updates live. It no
                longer blocks the request, so a run may take as many turns as its budget allows.
              </Hint>
            </div>
          </InlineForm>

          <Card padding="md">
            <h2 className="font-semibold">Runs</h2>
            {runs.length === 0 ? (
              <EmptyState
                icon={Play}
                title="No runs yet"
                description="Start one above. Every run keeps a full step-by-step record of who acted, what it cost and how long it took."
                className="mt-4 border-0 py-8"
              />
            ) : (
              <ul className="mt-4 divide-y hairline">
                {runs.map((run) => (
                  <li key={run.id}>
                    <Link href={`/admin/crews/runs/${run.id}`} className="flex items-center gap-3 py-2.5 text-sm transition hover:text-brand-400">
                      <span className="min-w-0 flex-1 truncate">{run.input}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-500">
                        {run.turnCount}t · {run.creditsSpent}c
                      </span>
                      <Badge tone={RUN_TONE[run.status] ?? 'slate'}>{run.status.replace(/_/g, ' ')}</Badge>
                      <span className="shrink-0 text-xs text-slate-500">{relativeTime(run.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="md">
            <h2 className="font-semibold">
              {crew.mode === 'sequential' ? 'Turn order' : 'Members'}
            </h2>
            <Hint className="mb-3">
              {crew.mode === 'sequential'
                ? 'Drag to reorder. Each member runs once, in this order, seeing everything before it.'
                : crew.mode === 'parallel'
                  ? 'All members reply once, at the same time, each seeing only the task.'
                  : 'The supervisor picks who acts next each turn, until it says DONE.'}
            </Hint>
            {/* Replaces the reorder-only list: members can now be added and
                removed here too, by dragging across from the pool. */}
            <TeamAssign
              crewId={crew.id}
              mode={crew.mode}
              available={allPersonas}
              initialMembers={members
                .map((m) => allPersonas.find((p) => p.id === m.personaId))
                .filter((p): p is (typeof allPersonas)[number] => Boolean(p))}
              supervisorId={members.find((m) => m.isSupervisor)?.personaId ?? null}
            />
          </Card>
        </div>

        <CrewSettings
          crew={crew}
          members={members.map((m) => ({
            personaId: m.personaId,
            name: allPersonas.find((p) => p.id === m.personaId)?.name ?? `Persona ${m.personaId}`,
            isSupervisor: m.isSupervisor,
          }))}
          allPersonas={allPersonas}
          projects={projectRows}
        />
      </div>
    </div>
  );
}
