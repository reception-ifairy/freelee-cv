import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { crews, personas } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { createCrewAction } from '@/modules/crews/actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Select, Checkbox, Textarea, Hint } from '@/components/ui/field';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Crews' };

const MODE_TONE = { sequential: 'brand', parallel: 'amber', supervisor: 'green' } as const;

export default async function CrewsPage() {
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  if (!(await isModuleEnabledForTeam(teamId, 'crews'))) {
    notFound();
  }

  const [teamCrews, catalog] = await Promise.all([
    db.select().from(crews).where(eq(crews.teamId, teamId)).orderBy(desc(crews.createdAt)),
    db.select().from(personas).where(eq(personas.teamId, teamId)).orderBy(personas.name),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-2xl font-bold tracking-tight">Crews</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Bot-to-bot orchestration — a crew of personas works a task together, hard-capped by turns and a credit budget.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Your crews</h2>
          {teamCrews.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No crews yet — create one to get started.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamCrews.map((crew) => (
                <Link
                  key={crew.id}
                  href={`/crews/${crew.id}`}
                  className="flex items-center justify-between gap-4 py-3.5 transition hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{crew.name}</p>
                    <p className="truncate text-xs text-slate-400">{crew.description || 'No description'}</p>
                  </div>
                  <Badge tone={MODE_TONE[crew.mode]} className="shrink-0">{crew.mode}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">New crew</h2>
          {catalog.length === 0 ? (
            <p className="text-sm text-slate-400">You need at least one persona before you can build a crew.</p>
          ) : (
            <form action={createCrewAction} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="Content pipeline" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} placeholder="Researcher drafts, editor tightens, publisher formats." />
              </div>
              <div>
                <Label htmlFor="mode">Mode</Label>
                <Select id="mode" name="mode" defaultValue="sequential">
                  <option value="sequential">Sequential — a fixed pipeline, one member after another</option>
                  <option value="parallel">Parallel — every member replies at once, independently</option>
                  <option value="supervisor">Supervisor — one member delegates to the others each turn</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="budgetCredits">Budget (credits)</Label>
                  <Input id="budgetCredits" name="budgetCredits" type="number" min={1} defaultValue={50} required />
                </div>
                <div>
                  <Label htmlFor="maxTurns">Max turns</Label>
                  <Input id="maxTurns" name="maxTurns" type="number" min={1} max={50} defaultValue={6} required />
                </div>
              </div>
              <div>
                <Label htmlFor="stopConditions">Stop phrases (optional)</Label>
                <Input id="stopConditions" name="stopConditions" placeholder="TASK COMPLETE, done for now" />
                <Hint>Comma-separated. A run stops early if a member&apos;s reply contains one of these.</Hint>
              </div>
              <div>
                <Label>Members</Label>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  {catalog.map((persona) => (
                    <label key={persona.id} className="flex items-center gap-2 text-sm">
                      <Checkbox name="personaIds" value={persona.id} />
                      {persona.name}
                    </label>
                  ))}
                </div>
                <Hint>Order above sets sequential turn order.</Hint>
              </div>
              <div>
                <Label htmlFor="supervisorPersonaId">Supervisor (supervisor mode only)</Label>
                <Select id="supervisorPersonaId" name="supervisorPersonaId" defaultValue="">
                  <option value="">None</option>
                  {catalog.map((persona) => (
                    <option key={persona.id} value={persona.id}>{persona.name}</option>
                  ))}
                </Select>
              </div>

              <button
                type="submit"
                className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Create crew
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
