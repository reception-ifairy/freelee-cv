'use server';

// Named admin-crews.ts, not admin/crews.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { personas, projects, conversations, conversationParticipants, conversationMessages } from '@/db/schema';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { effectiveMaxTurns, TEAM_FIELDS, type TeamField, type TeamSaveState } from '@/modules/crews/rules';
import { checkTeam } from '@/modules/crews/team-check';
import { crewReadiness } from '@/modules/crews/readiness';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { enqueue, requestCancel, jobForCrewRun } from '@/lib/jobs/queue';
import type { ActionState } from './auth';

/**
 * The builder's settings fields. Every message names the field in words and
 * says what to type, because each one is shown directly under its field — "Too
 * small: expected number to be >=1" under a box labelled *Budget* is the kind
 * of message the persona form had to be rescued from (#59).
 */
const teamSettingsSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, 'Give the team a name — at least 2 characters.').max(120, 'Keep the name under 120 characters.'),
  description: z.string().trim().max(2000, 'Keep the goal under 2,000 characters.').optional(),
  mode: z.enum(['sequential', 'parallel', 'supervisor'], { error: 'Pick how the bots work together.' }),
  budgetCredits: z.coerce
    .number({ error: 'Budget: enter a whole number of credits, from 1 to 100,000.' })
    .int('Budget: enter a whole number of credits, from 1 to 100,000.')
    .min(1, 'Budget: enter a whole number of credits, from 1 to 100,000.')
    .max(100000, 'Budget: enter a whole number of credits, from 1 to 100,000.'),
  maxTurns: z.coerce
    .number({ error: 'Turn limit: enter a whole number from 1 to 50.' })
    .int('Turn limit: enter a whole number from 1 to 50.')
    .min(1, 'Turn limit: enter a whole number from 1 to 50.')
    .max(50, 'Turn limit: enter a whole number from 1 to 50.'),
  stopConditions: z.string().trim().max(500, 'Keep the stop phrases under 500 characters in total.').optional(),
  projectId: z.string().trim().optional(),
});

function fieldOf(issue: z.core.$ZodIssue | undefined): TeamField | undefined {
  const field = String(issue?.path?.[0] ?? '');
  return (TEAM_FIELDS as readonly string[]).includes(field) ? (field as TeamField) : undefined;
}

/**
 * A mention handle nobody else in the conversation is using.
 *
 * Duplicated from group-chat's own `uniqueHandle` rather than imported: that
 * one lives in a `'use server'` file, so importing it is not the problem —
 * exporting it from there would make it a public endpoint. Two small copies
 * beat one public API.
 */
function handleFor(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'persona';
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}-${i}`;
  taken.add(candidate);
  return candidate;
}

/**
 * Creates or saves a bot team from the builder — one call, one Save button.
 *
 * Replaces three writers that disagreed with each other. The inline create
 * form, the settings panel and the drag board each wrote part of a team, and
 * the settings panel's save rebuilt every member with
 * `instructions: formData.get('instructions-<id>')` — a field no screen ever
 * rendered — so each "Save team" quietly wiped every member's role.
 *
 * Members now arrive as one ordered JSON list of `{ personaId, instructions,
 * isLead }` (validated in team-check.ts), so the order on screen, the roles and the
 * lead are saved together or not at all.
 */
export async function saveCrewAction(_prev: TeamSaveState, formData: FormData): Promise<TeamSaveState> {
  const admin = await requireAdmin();

  const parsed = teamSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? 'Please check the form.', field: fieldOf(issue) };
  }
  const data = parsed.data;

  const team = checkTeam(data.mode, formData.get('members'), data.maxTurns);
  if (!team.ok) return { error: team.error, field: 'members' };

  // The builder only offers personas that exist, but a persona can be deleted
  // while the page is open; the insert would then fail on its foreign key with
  // an error nobody could read.
  const ids = team.members.map((m) => m.personaId);
  const found = await db.select({ id: personas.id }).from(personas).where(inArray(personas.id, ids));
  if (found.length !== ids.length) {
    return { error: 'One of these bots no longer exists. Remove it and save again.', field: 'members' };
  }

  if (data.projectId) {
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
    if (!project) return { error: 'That project no longer exists. Pick another, or none.', field: 'projectId' };
  }

  const values = {
    name: data.name,
    description: data.description || null,
    mode: data.mode,
    budgetCredits: data.budgetCredits,
    maxTurns: team.maxTurns,
    stopConditions: (data.stopConditions ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    projectId: data.projectId || null,
    isActive: formData.get('isActive') === 'on',
  };

  const raised = team.raisedTurnsFrom !== null
    ? ` The turn limit went up from ${team.raisedTurnsFrom} to ${team.maxTurns}, so every bot gets its turn.`
    : '';

  if (data.id) {
    const crewId = data.id;
    const [existing] = await db.select({ id: crews.id }).from(crews).where(eq(crews.id, crewId)).limit(1);
    if (!existing) return { error: 'This bot team no longer exists.' };

    // Members are replaced wholesale rather than diffed: the list is short and
    // ordered, and a diff would have to reason about reordering as well as
    // adds and removes to arrive at the same place. In one transaction now, so
    // a failure half-way cannot leave a team with its settings saved and no
    // members.
    await db.transaction(async (tx) => {
      await tx.update(crews).set(values).where(eq(crews.id, crewId));
      await tx.delete(crewMembers).where(eq(crewMembers.crewId, crewId));
      await tx.insert(crewMembers).values(team.members.map((m) => ({ ...m, crewId })));
    });

    revalidatePath('/admin/crews');
    revalidatePath(`/admin/crews/${crewId}`);
    return { success: `Saved.${raised}`, maxTurns: team.maxTurns };
  }

  const crewId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(crews).values({ ...values, id: crewId, teamId: await getPlatformTeamId(), createdBy: admin.id });
    await tx.insert(crewMembers).values(team.members.map((m) => ({ ...m, crewId })));
  });

  revalidatePath('/admin/crews');
  // `created` puts a one-line "next: test it" note on the team page — the
  // obvious next step, which otherwise sits behind a tab you have never seen.
  redirect(`/admin/crews/${crewId}?created=1`);
}

export async function toggleCrewActiveAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));
  await db.update(crews).set({ isActive: sql`not ${crews.isActive}` }).where(eq(crews.id, id));
  revalidatePath('/admin/crews');
}

/**
 * Deletes the team, and with it its runs — `crew_runs.crew_id` cascades.
 *
 * The transcripts do NOT go: a run's conversation is an ordinary
 * `conversations` row with no FK back to the crew, so what the personas
 * actually said survives in the database. That asymmetry is deliberate and
 * worth knowing before you press it — and since the builder rework (#63) the
 * admin Rooms list shows rooms only, so once the team is gone those
 * transcripts are reachable by direct `/admin/rooms/<id>` link and nothing else.
 */
export async function deleteCrewAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));
  await db.delete(crews).where(eq(crews.id, id));
  revalidatePath('/admin/crews');
  redirect('/admin/crews');
}

/**
 * Starts a run from the admin panel.
 *
 * Builds the same shape `startCrewRunAction` does — a `kind: 'crew_run'`
 * conversation with every member as an ordinary participant — because
 * `runPersonaTurn` reads participants, not crew members. Then enqueues rather
 * than executing, so the request returns immediately and the run page watches
 * it live.
 */
export async function startAdminCrewRunAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const crewId = z.string().min(1).parse(formData.get('crewId'));
  // safeParse, not parse: a two-letter task used to throw out of the action
  // and land on the error page instead of under the text box.
  const task = z
    .string()
    .trim()
    .min(3, 'Describe the task in a few words first.')
    .max(4000, 'Keep the task under 4,000 characters.')
    .safeParse(formData.get('input') ?? '');
  if (!task.success) return { error: task.error.issues[0]?.message ?? 'Describe the task first.' };
  const input = task.data;

  const [crew] = await db.select().from(crews).where(eq(crews.id, crewId)).limit(1);
  if (!crew) return { error: 'Bot team not found.' };

  const members = await db
    .select()
    .from(crewMembers)
    .where(eq(crewMembers.crewId, crewId))
    .orderBy(crewMembers.position, crewMembers.id);

  // The same pre-check the Runs tab shows, asked again here so a page left
  // open since before a bot was unpublished cannot start a run that would fail.
  const readiness = await crewReadiness(crew, members);
  if (!readiness.ready) return { error: `Can't start yet: ${readiness.blocker}` };

  const memberPersonas = await db
    .select({ id: personas.id, name: personas.name, slug: personas.slug, currentVersionId: personas.currentVersionId })
    .from(personas)
    .where(inArray(personas.id, members.map((m) => m.personaId)));

  const runId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const taken = new Set<string>(['you']);

  await db.transaction(async (tx) => {
    await tx.insert(conversations).values({
      id: conversationId,
      teamId: crew.teamId,
      kind: 'crew_run',
      title: `${crew.name} — run`,
      createdBy: admin.id,
      visibility: 'team',
      projectId: crew.projectId,
      messageCount: 1,
    });

    await tx.insert(conversationParticipants).values({
      conversationId,
      participantType: 'user',
      participantId: admin.id,
      role: 'owner',
      displayName: admin.name ?? 'Admin',
      mentionHandle: 'you',
    });

    await tx.insert(conversationParticipants).values(
      members.map((member) => {
        const persona = memberPersonas.find((p) => p.id === member.personaId);
        return {
          conversationId,
          participantType: 'persona' as const,
          participantId: String(member.personaId),
          personaVersionId: persona?.currentVersionId ?? null,
          role: 'editor' as const,
          displayName: persona?.name ?? `Persona ${member.personaId}`,
          mentionHandle: handleFor(persona?.slug ?? persona?.name ?? 'persona', taken),
        };
      }),
    );

    await tx.insert(crewRuns).values({
      id: runId,
      crewId,
      teamId: crew.teamId,
      conversationId,
      status: 'queued',
      input,
      budgetCredits: crew.budgetCredits,
      // The run's own copy of the limit, so the run page's "turns used / limit"
      // agrees with what the runner allows — see effectiveMaxTurns.
      maxTurns: effectiveMaxTurns(crew.mode, crew.maxTurns, members.length),
      triggeredBy: admin.id,
    });

    await tx.insert(conversationMessages).values({
      conversationId,
      authorType: 'user',
      authorId: admin.id,
      content: input,
      status: 'complete',
      position: 1,
    });
  });

  await enqueue('crew.run', { crewRunId: runId });

  revalidatePath(`/admin/crews/${crewId}`);
  redirect(`/admin/crews/runs/${runId}`);
}

export async function cancelCrewRunAction(formData: FormData) {
  await requireAdmin();
  const runId = z.string().min(1).parse(formData.get('runId'));

  const job = await jobForCrewRun(runId);
  // Only a live job can be cancelled. Flagging a finished one would leave a
  // cancel_requested row that means nothing and confuses the next reader.
  if (job && (job.status === 'queued' || job.status === 'running')) {
    await requestCancel(job.id);
  }

  revalidatePath(`/admin/crews/runs/${runId}`);
}
