'use client';

import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Columns3, Crown, GripVertical, Info, ListOrdered, Plus, Search,
  TriangleAlert, X, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, FormMessage, Hint, Input, Label, Select, Textarea } from '@/components/ui/field';
import { PersonaMark } from '@/components/site/persona-mark';
import { saveCrewAction } from '@/server/actions/admin-crews';
import { MODE_COPY, MODE_ORDER, ordinal } from '@/modules/crews/labels';
import { MAX_ROLE_LENGTH, type CrewModeValue, type TeamField, type TeamSaveState } from '@/modules/crews/rules';
import { cn } from '@/lib/utils';

/**
 * Building a bot team — create and edit, one page, one Save.
 *
 * Replaces three screens that each owned part of a team and disagreed: an
 * inline create form with ten controls and a checkbox list of every persona,
 * a drag board (`team-assign.tsx`) that saved on every drop, and a settings
 * panel whose Save rebuilt the members and wiped their roles. The owner's brief
 * was "creating a team must be simpler and intuitive", so this reads top to
 * bottom as three questions — what is it for, who is on it, what are the
 * limits — and nothing is written until Save.
 *
 * Members travel to the server as one ordered JSON list in a hidden input, so
 * the order on screen is the order saved (see `checkTeam` in team-check.ts for the
 * bug that replaced).
 *
 * The drag list is a single vertical list, so it follows `block-list.tsx`
 * (`closestCenter`, axis-locked) rather than the two-column cross-container
 * set-up `team-assign.tsx` needed. Adding is a button on a search result, not
 * a drag across: with ~90 bots a search box finds one faster than a scrolled
 * column, and a button needs no fallback. Up/down buttons stay beside the grip
 * because a keyboard sensor is not a substitute for a control you can see.
 */

export type BuilderPersona = {
  id: number;
  slug: string;
  name: string;
  expertise: string | null;
  accentColor: string;
  categoryId: number | null;
  categorySlug: string | null;
  categoryColor: string | null;
  categoryName: string | null;
  sectorSlug: string | null;
  sectorName: string | null;
  /** Has a current version — the only thing a bot needs to take a turn. */
  published: boolean;
  active: boolean;
};

export type BuilderMember = { personaId: number; instructions: string; isLead: boolean };

export type BuilderTeam = {
  id?: string;
  name: string;
  description: string;
  mode: CrewModeValue;
  budgetCredits: number;
  maxTurns: number;
  stopConditions: string;
  projectId: string;
  isActive: boolean;
  members: BuilderMember[];
};

const MODE_ICON: Record<CrewModeValue, LucideIcon> = {
  sequential: ListOrdered,
  parallel: Columns3,
  supervisor: Crown,
};

const MEMBERS_HINT: Record<CrewModeValue, string> = {
  sequential: 'They take turns from top to bottom, and each one sees everything said before it. Drag or use the arrows to change the order.',
  parallel: 'Every bot gets the same task and answers on its own. The order does not matter.',
  supervisor: 'The lead (crown) hands out the work and decides when it is finished. The order does not matter.',
};

const ROLE_PLACEHOLDER: Record<CrewModeValue, string> = {
  sequential: "e.g. Find three facts with sources. Don't write the final text.",
  parallel: 'e.g. Answer as a cautious lawyer would.',
  supervisor: 'e.g. Checks the draft for legal risks. Does not rewrite it.',
};

/** Fields that live in the collapsed "Limits" section — an error on one must open it. */
const LIMIT_FIELDS = new Set<TeamField>(['budgetCredits', 'maxTurns', 'stopConditions', 'projectId']);

export function TeamBuilder({
  team,
  pool,
  projects,
}: {
  team: BuilderTeam;
  pool: BuilderPersona[];
  projects: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<TeamSaveState, FormData>(saveCrewAction, null);

  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [mode, setMode] = useState<CrewModeValue>(team.mode);
  const [members, setMembers] = useState<BuilderMember[]>(team.members);
  const [budget, setBudget] = useState(String(team.budgetCredits));
  const [maxTurns, setMaxTurns] = useState(String(team.maxTurns));
  const [stopPhrases, setStopPhrases] = useState(team.stopConditions);
  const [projectId, setProjectId] = useState(team.projectId);
  const [isActive, setIsActive] = useState(team.isActive);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Every field is controlled, so "unsaved changes" is a comparison rather
  // than a guess, and the Limits summary can describe what is actually typed.
  const snapshot = JSON.stringify([name, description, mode, members, budget, maxTurns, stopPhrases, projectId, isActive]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // Reacting to a new action result during render rather than in an effect —
  // the pattern block-list.tsx uses for server rows — so the raised turn limit
  // and the opened Limits section land in the same render as the message.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.success) {
      const savedTurns = state.maxTurns ? String(state.maxTurns) : maxTurns;
      setMaxTurns(savedTurns);
      setSavedSnapshot(JSON.stringify([name, description, mode, members, budget, savedTurns, stopPhrases, projectId, isActive]));
    }
    if (state?.field && LIMIT_FIELDS.has(state.field)) setLimitsOpen(true);
  }

  // Put the cursor on the field the error is about. An effect, because the
  // element may only just have been revealed by the render above.
  useEffect(() => {
    if (!state?.field) return;
    const target = document.getElementById(`team-${state.field}`);
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [state]);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const onTeam = new Set(members.map((m) => m.personaId));

  // Every word must match somewhere — "legal draft" narrows rather than widens.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const activePool = pool.filter((p) => p.active);
  const results = activePool
    .filter((p) => {
      const haystack = [p.name, p.categoryName, p.sectorName, p.expertise].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    // Unpublished bots stay visible (so nobody wonders where one went) but
    // sink below the ones that can actually be added.
    .sort((a, b) => Number(b.published) - Number(a.published));

  const lead = members.find((m) => m.isLead);
  const turnsTyped = Number(maxTurns) || 0;
  const raiseTo = mode === 'parallel' && members.length > turnsTyped ? members.length : null;
  const unpublishedMembers = members.map((m) => byId.get(m.personaId)).filter((p) => p && !p.published).map((p) => p!.name);
  const projectName = projects.find((p) => p.id === projectId)?.name;

  const sensors = useSensors(
    // A distance threshold so a click on a button inside the row is not
    // swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function add(personaId: number) {
    setMembers((current) => (current.some((m) => m.personaId === personaId)
      ? current
      : [...current, { personaId, instructions: '', isLead: false }]));
  }

  function remove(personaId: number) {
    setMembers((current) => current.filter((m) => m.personaId !== personaId));
  }

  function move(index: number, delta: -1 | 1) {
    setMembers((current) => {
      const to = index + delta;
      return to < 0 || to >= current.length ? current : arrayMove(current, index, to);
    });
  }

  function makeLead(personaId: number) {
    // Exactly one lead, and only ever a member: the crown lives on member
    // rows, so there is nothing else to pick. The old supervisor dropdown
    // listed every persona on the platform.
    setMembers((current) => current.map((m) => ({ ...m, isLead: m.personaId === personaId })));
  }

  function setRole(personaId: number, instructions: string) {
    setMembers((current) => current.map((m) => (m.personaId === personaId ? { ...m, instructions } : m)));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMembers((current) => {
      const from = current.findIndex((m) => m.personaId === Number(active.id));
      const to = current.findIndex((m) => m.personaId === Number(over.id));
      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
    });
  }

  // Submitted by hand rather than through `<form action>`: React 19 resets a
  // form after its action runs, and this one is entirely controlled state.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const errorFor = (field: TeamField) => (state?.error && state.field === field ? <FormMessage state={{ error: state.error }} /> : null);

  return (
    // noValidate: the server checks every field and says which one is wrong;
    // a browser bubble on a collapsed section would point at nothing visible.
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {team.id ? <input type="hidden" name="id" value={team.id} /> : null}
      <input
        type="hidden"
        name="members"
        value={JSON.stringify(members.map((m) => ({ personaId: m.personaId, instructions: m.instructions, isLead: m.isLead })))}
      />

      {/* ── 1 ─────────────────────────────────────────────────────────── */}
      <Step n={1} title="What is this team for?">
        <div>
          <Label htmlFor="team-name">Name</Label>
          <Input
            id="team-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Blog post team"
            maxLength={120}
            aria-invalid={state?.field === 'name' || undefined}
          />
          {errorFor('name')}
        </div>

        <div>
          <Label htmlFor="team-description">Goal</Label>
          <Textarea
            id="team-description"
            name="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Turn a topic into a checked, ready-to-publish blog post."
            className="min-h-0"
          />
          <Hint>For you and other admins. The bots do not see it.</Hint>
          {errorFor('description')}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">How do they work together?</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {MODE_ORDER.map((value) => {
              const copy = MODE_COPY[value];
              const Icon = MODE_ICON[value];
              const selected = mode === value;
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-brand-500/40',
                    selected
                      ? 'glow-ring border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={selected}
                    onChange={() => setMode(value)}
                    id={value === MODE_ORDER[0] ? 'team-mode' : undefined}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4 shrink-0 text-brand-500" aria-hidden />
                    {copy.label}
                    {selected ? <Check className="ml-auto size-4 shrink-0 text-brand-500" aria-hidden /> : null}
                  </span>
                  <span className="mt-1 text-xs text-slate-600 dark:text-slate-300">{copy.explanation}</span>
                  <span className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">For example: {copy.example}</span>
                </label>
              );
            })}
          </div>
          {errorFor('mode')}
        </fieldset>
      </Step>

      {/* ── 2 ─────────────────────────────────────────────────────────── */}
      <Step n={2} title="Who is on the team" hint={MEMBERS_HINT[mode]}>
        <div>
          <Label htmlFor="team-search">Find bots</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              id="team-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Enter in a search box must not submit the whole team.
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder="Search by name or category — e.g. legal, writer, marketing"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {words.length ? `${results.length} of ${activePool.length} bots match` : `${activePool.length} bots`}
          </p>

          <ul className="mt-2 grid max-h-80 gap-2 overflow-y-auto rounded-card border hairline p-2 sm:grid-cols-2">
            {results.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-500 sm:col-span-2">
                No bot matches “{query}”. Try a shorter word or a category name.
              </li>
            ) : (
              results.map((persona) => {
                const added = onTeam.has(persona.id);
                return (
                  <li
                    key={persona.id}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-control border hairline p-2',
                      !persona.published && 'opacity-60',
                    )}
                  >
                    <PersonaFace persona={persona} />
                    {added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" aria-hidden /> Added
                      </span>
                    ) : persona.published ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => add(persona.id)} aria-label={`Add ${persona.name}`}>
                        <Plus /> Add
                      </Button>
                    ) : (
                      <span
                        className="w-20 shrink-0 text-right text-[11px] leading-tight text-slate-500"
                        title="This bot has no published version, so it cannot take a turn. Publish it on its Publishing tab first."
                      >
                        Not published yet
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div id="team-members" tabIndex={-1} className="outline-none">
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            On the team {members.length ? <span className="text-slate-500">({members.length})</span> : null}
          </p>

          {members.length === 0 ? (
            <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/15">
              No bots yet. Add them from the list above.
            </p>
          ) : (
            <DndContext
              // A fixed id keeps dnd-kit's generated aria ids identical on
              // the server and the client, so hydration does not complain.
              id="team-builder-members"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={members.map((m) => m.personaId)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-2">
                  {members.map((member, index) => (
                    <MemberRow
                      key={member.personaId}
                      member={member}
                      persona={byId.get(member.personaId)}
                      index={index}
                      count={members.length}
                      mode={mode}
                      onMove={move}
                      onRemove={remove}
                      onLead={makeLead}
                      onRole={setRole}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}

          <div className="mt-3 space-y-2">
            {mode === 'supervisor' && members.length > 0 && !lead ? (
              <Notice tone="warn">Pick a lead: press the crown next to the bot that should hand out the work.</Notice>
            ) : null}
            {mode === 'supervisor' && members.length === 1 ? (
              <Notice tone="warn">A lead needs at least one other bot to hand work to. Add one more.</Notice>
            ) : null}
            {mode !== 'supervisor' && members.length === 1 ? (
              <Notice tone="warn">One bot on its own is just a chat. Teams work best with two or more.</Notice>
            ) : null}
            {raiseTo ? (
              <Notice tone="info">
                Every bot answers once, so the turn limit will go up from {turnsTyped} to {raiseTo} when you save.
              </Notice>
            ) : null}
            {unpublishedMembers.length ? (
              <Notice tone="warn">
                Not published yet: {unpublishedMembers.join(', ')}. You can save the team, but it cannot run until they are
                published.
              </Notice>
            ) : null}
          </div>
          {errorFor('members')}
        </div>
      </Step>

      {/* ── 3 ─────────────────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setLimitsOpen((open) => !open)}
          aria-expanded={limitsOpen}
          aria-controls="team-limits"
          className="flex w-full items-start gap-3 text-left"
        >
          <StepNumber n={3} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">Limits</span>
              <span className="text-xs text-slate-500">Advanced — the defaults are fine to start with</span>
            </span>
            <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
              Budget {Number(budget || 0).toLocaleString('en')} credits · up to {raiseTo ?? (turnsTyped || '?')} turns ·{' '}
              {stopPhrases.trim() ? `stops on “${stopPhrases.trim()}”` : 'no stop phrase'} · {projectName ?? 'no project'} ·{' '}
              {isActive ? 'enabled' : 'switched off'}
            </span>
          </span>
          <ChevronDown className={cn('mt-1 size-4 shrink-0 text-slate-400 transition', limitsOpen && 'rotate-180')} aria-hidden />
        </button>

        {/* Hidden, never unmounted: these inputs must still submit while the
            section is collapsed, or saving would reset them. */}
        <div id="team-limits" className={cn('mt-5 grid gap-4 sm:grid-cols-2', !limitsOpen && 'hidden')}>
          <div>
            <Label htmlFor="team-budgetCredits">Budget (credits)</Label>
            <Input
              id="team-budgetCredits"
              name="budgetCredits"
              type="number"
              inputMode="numeric"
              min={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <Hint>The most one run may spend. Every bot reply costs credits; when the budget is used up, the run stops.</Hint>
            {errorFor('budgetCredits')}
          </div>

          <div>
            <Label htmlFor="team-maxTurns">Turn limit</Label>
            <Input
              id="team-maxTurns"
              name="maxTurns"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={maxTurns}
              onChange={(e) => setMaxTurns(e.target.value)}
            />
            <Hint>
              The most replies one run may have, counting every bot. It stops a team that goes round in circles.
              {raiseTo ? ` In "All at once" it is raised to ${raiseTo} so every bot answers.` : ''}
            </Hint>
            {errorFor('maxTurns')}
          </div>

          <div>
            <Label htmlFor="team-stopConditions">Stop phrase (optional)</Label>
            <Input
              id="team-stopConditions"
              name="stopConditions"
              value={stopPhrases}
              onChange={(e) => setStopPhrases(e.target.value)}
              placeholder="e.g. TASK COMPLETE"
            />
            <Hint>If any reply contains it, the run ends there. Separate several with commas.</Hint>
            {errorFor('stopConditions')}
          </div>

          <div>
            <Label htmlFor="team-projectId">Project (optional)</Label>
            <Select id="team-projectId" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Hint>Files the team and its runs under a project, so their cost adds up there.</Hint>
            {errorFor('projectId')}
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox name="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Enabled
            </label>
            <Hint>A switched-off team keeps its settings and history but cannot start new runs.</Hint>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="min-w-0 sm:mr-auto">
          {state?.error && !state.field ? <FormMessage state={state} /> : null}
          {state?.error && state.field ? (
            <FormMessage state={{ error: `Not saved — ${state.error}` }} />
          ) : null}
          {state?.success && !dirty ? <FormMessage state={state} /> : null}
          {/* Edit only: on a new team everything is unsaved, which says nothing. */}
          {team.id && dirty && !pending ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">You have unsaved changes.</p>
          ) : null}
        </div>
        <Button type="submit" loading={pending} className="sm:w-auto">
          {team.id ? 'Save team' : 'Create team'}
        </Button>
      </div>
    </form>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-700 dark:text-brand-300">
      {n}
    </span>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    // p-4 under `sm`: every pixel of a 360px screen goes to the bot names.
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <StepNumber n={n} />
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </Card>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const Icon = tone === 'warn' ? TriangleAlert : Info;
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
        tone === 'warn'
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
          : 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function PersonaFace({ persona }: { persona: BuilderPersona | undefined }) {
  const where = persona
    ? [persona.categoryName, persona.sectorName].filter(Boolean).join(' · ') || persona.expertise || 'Unfiled'
    : '';
  return (
    <>
      {persona ? (
        <PersonaMark
          personaKey={persona.slug}
          categoryKey={persona.categorySlug}
          sectorKey={persona.sectorSlug}
          categoryIndex={persona.categoryId}
          accent={persona.categoryColor ?? persona.accentColor}
          className="size-7 shrink-0"
        />
      ) : (
        <span className="size-7 shrink-0 rounded-lg bg-slate-200 dark:bg-white/10" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{persona?.name ?? 'Unknown bot'}</span>
        <span className="block truncate text-[11px] text-slate-500">{where}</span>
      </span>
    </>
  );
}

function IconButton({
  label, onClick, disabled, children,
}: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="focus-ring grid size-7 shrink-0 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}

function MemberRow({
  member, persona, index, count, mode, onMove, onRemove, onLead, onRole,
}: {
  member: BuilderMember;
  persona: BuilderPersona | undefined;
  index: number;
  count: number;
  mode: CrewModeValue;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (personaId: number) => void;
  onLead: (personaId: number) => void;
  onRole: (personaId: number, instructions: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: member.personaId,
  });
  const name = persona?.name ?? 'this bot';
  const roleId = `team-role-${member.personaId}`;
  const isLead = mode === 'supervisor' && member.isLead;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-control border bg-white p-2.5 dark:bg-white/[0.02]',
        isLead ? 'border-amber-400/60' : 'hairline',
        isDragging && 'relative z-10 opacity-70 shadow-lg',
      )}
    >
      {/* Wraps rather than squeezes: at phone width the name keeps a readable
          width and the buttons drop to their own line, right-aligned. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          {/* The grip is the only thing that starts a drag, so every button in
              the row stays clickable — the same split block-card.tsx makes. */}
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Drag to move ${name}`}
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
          >
            <GripVertical className="size-4" />
          </button>

          {mode === 'sequential' ? (
            <span
              className="grid h-6 min-w-9 shrink-0 place-items-center rounded-md bg-brand-500/10 px-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300"
              title={`Goes ${ordinal(index + 1)}`}
            >
              {ordinal(index + 1)}
            </span>
          ) : null}

          <PersonaFace persona={persona} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {mode === 'supervisor' ? (
            <button
              type="button"
              onClick={() => onLead(member.personaId)}
              aria-pressed={isLead}
              title={isLead ? `${name} is the lead` : `Make ${name} the lead`}
              className={cn(
                'focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold transition',
                isLead
                  ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-white/10',
              )}
            >
              <Crown className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{isLead ? 'Lead' : 'Make lead'}</span>
              <span className="sr-only sm:hidden">{isLead ? 'Lead' : 'Make lead'}</span>
            </button>
          ) : null}

          {persona && !persona.published ? (
            <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">Not published</span>
          ) : null}

          <span className="flex shrink-0 items-center">
            <IconButton label={`Move ${name} up`} onClick={() => onMove(index, -1)} disabled={index === 0}>
              <ArrowUp className="size-3.5" />
            </IconButton>
            <IconButton label={`Move ${name} down`} onClick={() => onMove(index, 1)} disabled={index === count - 1}>
              <ArrowDown className="size-3.5" />
            </IconButton>
            <IconButton label={`Remove ${name} from the team`} onClick={() => onRemove(member.personaId)}>
              <X className="size-3.5" />
            </IconButton>
          </span>
        </div>
      </div>

      <div className="mt-2 sm:pl-6">
        <label htmlFor={roleId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Role on this team <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <Textarea
          id={roleId}
          rows={2}
          value={member.instructions}
          onChange={(e) => onRole(member.personaId, e.target.value)}
          maxLength={MAX_ROLE_LENGTH}
          placeholder={isLead ? 'e.g. Split the task, hand each part to the right bot, check the result.' : ROLE_PLACEHOLDER[mode]}
          className="min-h-0 text-xs"
        />
      </div>
    </li>
  );
}
