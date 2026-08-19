'use client';

import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Select, Label, Hint, Checkbox } from '@/components/ui/field';
import { saveCrewAction } from '@/server/actions/admin-crews';
/**
 * The membership fields this form needs. Members are added and removed by
 * dragging now (see `team-assign.tsx`), so this panel keeps only the settings
 * that are not positional.
 */
export type MemberRow = { personaId: number; name: string; isSupervisor: boolean };

type Crew = {
  id: string; name: string; description: string | null; mode: string;
  budgetCredits: number; maxTurns: number; stopConditions: string[];
  isActive: boolean; projectId: string | null;
};

/**
 * Everything about a crew that was previously unreachable.
 *
 * Crews were create-only: no edit, no delete, no way to add or remove a member,
 * and `crew_members.instructions` — a per-member prompt append that the runner
 * genuinely uses — had never been written by any UI at all.
 */
export function CrewSettings({
  crew, members, allPersonas, projects,
}: {
  crew: Crew;
  members: MemberRow[];
  allPersonas: { id: number; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const selected = new Set(members.map((m) => m.personaId));
  const supervisor = members.find((m) => m.isSupervisor)?.personaId ?? '';

  // Current members first, in turn order, then the rest. Ticking a box appends
  // to the submitted order, so the list you see is the order you get.
  const ordered = [
    ...members.map((m) => ({ id: m.personaId, name: m.name })),
    ...allPersonas.filter((p) => !selected.has(p.id)),
  ];

  return (
    <InlineForm action={saveCrewAction} title="Team settings" submitLabel="Save team">
      <input type="hidden" name="id" value={crew.id} />
      {/* saveCrewAction replaces membership from `personaIds`, so the current
          members ride along as hidden fields. Without them, saving a name
          change would empty the team. */}
      {members.map((m) => (
        <input key={m.personaId} type="hidden" name="personaIds" value={m.personaId} />
      ))}
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required defaultValue={crew.name} />
      </div>
      <div>
        <Label htmlFor="description">What does it do?</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={crew.description ?? ''} />
      </div>
      <div>
        <Label htmlFor="mode">Mode</Label>
        <Select id="mode" name="mode" defaultValue={crew.mode}>
          <option value="sequential">Pipeline — each in turn</option>
          <option value="parallel">Fan-out — all at once</option>
          <option value="supervisor">Delegating — one picks who acts</option>
        </Select>
      </div>

      {/* The member list moved to the drag board above. Leaving a checkbox
          list here as well would give two controls for one thing that could
          disagree — and the one that submitted last would win silently. */}
      <div>
        <Label htmlFor="supervisorId">Supervisor</Label>
        <Select id="supervisorId" name="supervisorId" defaultValue={String(supervisor)}>
          <option value="">First member</option>
          {allPersonas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Hint>Only used in delegating mode.</Hint>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="budgetCredits">Budget</Label>
          <Input id="budgetCredits" name="budgetCredits" type="number" min={1} defaultValue={crew.budgetCredits} />
        </div>
        <div>
          <Label htmlFor="maxTurns">Max turns</Label>
          <Input id="maxTurns" name="maxTurns" type="number" min={1} defaultValue={crew.maxTurns} />
        </div>
      </div>

      <div>
        <Label htmlFor="stopConditions">Stop phrases</Label>
        <Input id="stopConditions" name="stopConditions" defaultValue={crew.stopConditions.join(', ')} />
      </div>

      <div>
        <Label htmlFor="projectId">Project</Label>
        <Select id="projectId" name="projectId" defaultValue={crew.projectId ?? ''}>
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isActive" defaultChecked={crew.isActive} /> Enabled
      </label>
    </InlineForm>
  );
}
