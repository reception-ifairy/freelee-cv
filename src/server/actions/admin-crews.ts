'use server';

// Named admin-crews.ts, not admin/crews.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { personas, conversations, conversationParticipants, conversationMessages } from '@/db/schema';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { enqueue, requestCancel, jobForCrewRun } from '@/lib/jobs/queue';
import type { ActionState } from './auth';

const crewSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, 'Give the team a name.').max(120),
  description: z.string().trim().max(2000).optional(),
  mode: z.enum(['sequential', 'parallel', 'supervisor']),
  budgetCredits: z.coerce.number().int().min(1).max(100000).default(50),
  maxTurns: z.coerce.number().int().min(1).max(50).default(6),
  stopConditions: z.string().trim().max(500).optional(),
  projectId: z.string().trim().optional(),
  isActive: z.string().optional(),
});

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

export async function saveCrewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = crewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const data = parsed.data;

  // The order the boxes were ticked IS the pipeline order in sequential mode.
  //
  // `createCrewAction` derived position from `db.select().from(personas)` row
  // order while the form said "Order above sets sequential turn order" — so the
  // entire behaviour of sequential mode was arbitrary and the UI claimed
  // otherwise. formData.getAll preserves submission order.
  const personaIds = formData
    .getAll('personaIds')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (personaIds.length === 0) return { error: 'A bot team needs at least one persona.' };

  const supervisorId = Number(formData.get('supervisorId')) || personaIds[0];
  const stopConditions = (data.stopConditions ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const values = {
    name: data.name,
    description: data.description || null,
    mode: data.mode,
    budgetCredits: data.budgetCredits,
    maxTurns: data.maxTurns,
    stopConditions,
    projectId: data.projectId || null,
    isActive: formData.get('isActive') === 'on',
  };

  if (data.id) {
    await db.update(crews).set(values).where(eq(crews.id, data.id));
    // Members are replaced wholesale rather than diffed: the list is short, the
    // order matters, and a diff would have to reason about reordering as well
    // as adds and removes to arrive at the same place.
    await db.delete(crewMembers).where(eq(crewMembers.crewId, data.id));
    await db.insert(crewMembers).values(
      personaIds.map((personaId, index) => ({
        crewId: data.id!,
        personaId,
        position: index,
        isSupervisor: personaId === supervisorId,
        instructions: (formData.get(`instructions-${personaId}`) as string | null)?.trim() || null,
      })),
    );

    revalidatePath('/admin/crews');
    revalidatePath(`/admin/crews/${data.id}`);
    return { success: `Saved "${data.name}".` };
  }

  const crewId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(crews).values({ ...values, id: crewId, teamId: await getPlatformTeamId(), createdBy: admin.id });
    await tx.insert(crewMembers).values(
      personaIds.map((personaId, index) => ({
        crewId,
        personaId,
        position: index,
        isSupervisor: personaId === supervisorId,
      })),
    );
  });

  revalidatePath('/admin/crews');
  redirect(`/admin/crews/${crewId}`);
}

/** Reorders members without touching anything else — the drag-and-drop endpoint. */
export async function reorderCrewMembersAction(formData: FormData) {
  await requireAdmin();
  const crewId = z.string().min(1).parse(formData.get('crewId'));
  const order = z.array(z.number().int()).parse(JSON.parse(String(formData.get('order') ?? '[]')));

  await db.transaction(async (tx) => {
    for (const [index, memberId] of order.entries()) {
      await tx.update(crewMembers).set({ position: index }).where(
        and(eq(crewMembers.id, memberId), eq(crewMembers.crewId, crewId)),
      );
    }
  });

  revalidatePath(`/admin/crews/${crewId}`);
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
 * actually said survives in the rooms view. That asymmetry is deliberate and
 * worth knowing before you press it.
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
  const input = z.string().trim().min(3, 'Give the team something to work on.').max(4000).parse(formData.get('input'));

  const [crew] = await db.select().from(crews).where(eq(crews.id, crewId)).limit(1);
  if (!crew) return { error: 'Bot team not found.' };
  if (!crew.isActive) return { error: 'This bot team is disabled. Enable it before starting a run.' };

  const members = await db.select().from(crewMembers).where(eq(crewMembers.crewId, crewId)).orderBy(crewMembers.position);
  if (members.length === 0) return { error: 'This bot team has no members.' };

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
      maxTurns: crew.maxTurns,
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
