'use client';

import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Select, Label, Hint, Checkbox } from '@/components/ui/field';
import { saveCrewAction } from '@/server/actions/admin-crews';
import type { MemberRow } from './member-order';

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

      <div>
        <Label>Members</Label>
        <Hint className="mb-2">Untick to remove. New ticks join at the end of the order.</Hint>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-control border hairline p-2">
          {ordered.map((persona) => (
            <label key={persona.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]">
              <Checkbox name="personaIds" value={persona.id} defaultChecked={selected.has(persona.id)} />
              {persona.name}
            </label>
          ))}
        </div>
      </div>

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
