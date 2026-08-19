import type { Metadata } from 'next';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { personas, projects } from '@/db/schema';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Select, Label, Hint, Checkbox } from '@/components/ui/field';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { saveCrewAction } from '@/server/actions/admin-crews';
import { CrewsList, type CrewRowData } from './crews-list';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bot teams' };

export default async function AdminCrewsPage() {
  const [rows, availablePersonas, projectRows, view] = await Promise.all([
    db
      .select({
        id: crews.id,
        name: crews.name,
        description: crews.description,
        mode: crews.mode,
        isActive: crews.isActive,
        projectName: projects.name,
        // Correlated subqueries, explicitly qualified — see the comment in
        // /admin/projects/page.tsx about what an unqualified "id" does inside
        // one of these.
        memberCount: sql<number>`(select count(*)::int from ${crewMembers} where ${crewMembers.crewId} = ${sql.raw('"crews"."id"')})`,
        runCount: sql<number>`(select count(*)::int from ${crewRuns} where ${crewRuns.crewId} = ${sql.raw('"crews"."id"')})`,
        lastRunStatus: sql<string | null>`(select status::text from ${crewRuns} where ${crewRuns.crewId} = ${sql.raw('"crews"."id"')} order by created_at desc limit 1)`,
      })
      .from(crews)
      .leftJoin(projects, eq(projects.id, crews.projectId))
      .orderBy(desc(crews.createdAt)),
    db
      .select({ id: personas.id, name: personas.name })
      .from(personas)
      .where(eq(personas.isActive, true))
      .orderBy(asc(personas.name)),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
    getAdminView('crews'),
  ]);

  return (
    <div>
      <PageHeader
        title="Bot teams"
        description="Several personas working one task together — as a pipeline, a fan-out, or with one persona delegating to the rest."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CrewsList rows={rows as CrewRowData[]} view={view} />
        </div>

        <InlineForm action={saveCrewAction} title="New bot team" submitLabel="Create team">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Research and draft" />
          </div>
          <div>
            <Label htmlFor="description">What does it do?</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div>
            <Label htmlFor="mode">Mode</Label>
            <Select id="mode" name="mode" defaultValue="sequential">
              <option value="sequential">Pipeline — each in turn, seeing the work so far</option>
              <option value="parallel">Fan-out — all at once, independently</option>
              <option value="supervisor">Delegating — one picks who acts next</option>
            </Select>
          </div>

          <div>
            <Label>Members</Label>
            <Hint className="mb-2">
              In pipeline mode, <strong>the order you tick them is the order they run in</strong>.
            </Hint>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-control border hairline p-2">
              {availablePersonas.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">No active personas to add yet.</p>
              ) : (
                availablePersonas.map((persona) => (
                  <label key={persona.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]">
                    <Checkbox name="personaIds" value={persona.id} />
                    {persona.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="supervisorId">Supervisor (delegating mode)</Label>
            <Select id="supervisorId" name="supervisorId" defaultValue="">
              <option value="">First member</option>
              {availablePersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="budgetCredits">Budget</Label>
              <Input id="budgetCredits" name="budgetCredits" type="number" min={1} defaultValue={50} />
            </div>
            <div>
              <Label htmlFor="maxTurns">Max turns</Label>
              <Input id="maxTurns" name="maxTurns" type="number" min={1} defaultValue={6} />
            </div>
          </div>

          <div>
            <Label htmlFor="stopConditions">Stop phrases</Label>
            <Input id="stopConditions" name="stopConditions" placeholder="TASK COMPLETE, DONE" />
            <Hint>Comma separated. A reply containing one ends the run.</Hint>
          </div>

          <div>
            <Label htmlFor="projectId">Project</Label>
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">No project</option>
              {projectRows.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked /> Enabled
          </label>
        </InlineForm>
      </div>
    </div>
  );
}
