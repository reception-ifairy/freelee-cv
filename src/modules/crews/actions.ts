'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { crews, crewMembers, crewRuns, conversations, conversationParticipants, conversationMessages, personas } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertModuleEnabled } from '@/lib/modules/db';
import { slugify } from '@/lib/utils';
import { executeCrewRun } from './runner';

const MODULE_KEY = 'crews';

/** Mirrors group-chat's uniqueHandle() — crew-run conversations use the same @handle/mention scheme. */
async function uniqueHandle(conversationId: string, base: string): Promise<string> {
  const root = slugify(base) || 'participant';
  let candidate = root;

  for (let i = 2; i < 50; i++) {
    const [existing] = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.mentionHandle, candidate)))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const createCrewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  mode: z.enum(['sequential', 'parallel', 'supervisor']),
  budgetCredits: z.coerce.number().int().min(1).max(100_000),
  maxTurns: z.coerce.number().int().min(1).max(50),
  stopConditions: z.string().trim().max(500).optional(),
});

export async function createCrewAction(formData: FormData) {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await assertModuleEnabled(teamId, MODULE_KEY);

  const parsed = createCrewSchema.parse(Object.fromEntries(formData));
  const personaIds = formData.getAll('personaIds').map(Number).filter(Number.isFinite);
  const supervisorPersonaId = Number(formData.get('supervisorPersonaId')) || undefined;
  if (personaIds.length === 0) throw new Error('A crew needs at least one persona.');

  const selectable = await db.select().from(personas).where(eq(personas.teamId, teamId));
  const wanted = new Set(personaIds);
  const chosen = selectable.filter((p) => wanted.has(p.id));

  const stopConditions = (parsed.stopConditions ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const crewId = await db.transaction(async (tx) => {
    const [crew] = await tx
      .insert(crews)
      .values({
        teamId,
        name: parsed.name,
        description: parsed.description || null,
        mode: parsed.mode,
        budgetCredits: parsed.budgetCredits,
        maxTurns: parsed.maxTurns,
        stopConditions,
        createdBy: user.id,
      })
      .returning({ id: crews.id });

    for (const [index, persona] of chosen.entries()) {
      await tx.insert(crewMembers).values({
        crewId: crew.id,
        personaId: persona.id,
        position: index,
        isSupervisor: parsed.mode === 'supervisor' && persona.id === supervisorPersonaId,
      });
    }

    return crew.id;
  });

  revalidatePath('/crews');
  redirect(`/crews/${crewId}`);
}

const startRunSchema = z.object({ crewId: z.string().min(1), input: z.string().trim().min(1).max(8000) });

/**
 * Creates the pinned `kind: 'crew_run'` conversation, adds every crew
 * member persona (plus the triggering user) as ordinary participants, then
 * runs the whole crew **synchronously within this request** before
 * redirecting — see runner.ts's top comment for why there's no background
 * worker yet. `<RunLive>` + the run page's own polling of message history
 * cover the "watch it happen" UX in the meantime for slower runs.
 */
export async function startCrewRunAction(formData: FormData) {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await assertModuleEnabled(teamId, MODULE_KEY);

  const { crewId, input } = startRunSchema.parse(Object.fromEntries(formData));

  const [crew] = await db.select().from(crews).where(and(eq(crews.id, crewId), eq(crews.teamId, teamId))).limit(1);
  if (!crew) throw new Error('Crew not found.');
  if (!crew.isActive) throw new Error('This crew is disabled.');

  const members = await db.select().from(crewMembers).where(eq(crewMembers.crewId, crewId)).orderBy(crewMembers.position);
  if (members.length === 0) throw new Error('This crew has no members.');

  const memberPersonas = await db.select().from(personas).where(eq(personas.teamId, teamId));
  const personaById = new Map(memberPersonas.map((p) => [p.id, p]));

  const runId = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({ teamId, kind: 'crew_run', title: `${crew.name} — run`, createdBy: user.id, visibility: 'team' })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values({
      conversationId: conversation.id,
      participantType: 'user',
      participantId: user.id,
      role: 'owner',
      displayName: user.name ?? 'You',
      mentionHandle: await uniqueHandle(conversation.id, user.name ?? user.id.slice(0, 8)),
    });

    for (const member of members) {
      const persona = personaById.get(member.personaId);
      if (!persona) continue;
      await tx.insert(conversationParticipants).values({
        conversationId: conversation.id,
        participantType: 'persona',
        participantId: String(persona.id),
        personaVersionId: persona.currentVersionId,
        role: 'editor',
        displayName: persona.name,
        mentionHandle: await uniqueHandle(conversation.id, persona.slug),
      });
    }

    const [run] = await tx
      .insert(crewRuns)
      .values({
        crewId: crew.id,
        teamId,
        conversationId: conversation.id,
        input,
        budgetCredits: crew.budgetCredits,
        maxTurns: crew.maxTurns,
        triggeredBy: user.id,
      })
      .returning({ id: crewRuns.id });

    // Position hardcoded to 1, not mentions.ts's reserveNextPosition() — this
    // conversation was just created on `tx` and isn't visible to `db`'s
    // separate connection until the transaction commits, and it's always
    // the first message here regardless (runner.ts's steps run after this
    // transaction commits, over `db`, and correctly use reserveNextPosition).
    await tx.insert(conversationMessages).values({
      conversationId: conversation.id,
      authorType: 'user',
      authorId: user.id,
      content: input,
      status: 'complete',
      position: 1,
    });
    await tx.update(conversations).set({ messageCount: 1 }).where(eq(conversations.id, conversation.id));

    return run.id;
  });

  await executeCrewRun(runId);

  revalidatePath(`/crews/${crewId}`);
  redirect(`/crews/runs/${runId}`);
}

export async function assertRunAccess(runId: string, userId: string): Promise<{ conversationId: string; teamId: string }> {
  const [run] = await db.select().from(crewRuns).where(eq(crewRuns.id, runId)).limit(1);
  if (!run) throw new Error('NOT_FOUND');

  const [participant] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, run.conversationId),
        eq(conversationParticipants.participantType, 'user'),
        eq(conversationParticipants.participantId, userId),
      ),
    )
    .limit(1);
  if (!participant) throw new Error('FORBIDDEN');

  return { conversationId: run.conversationId, teamId: run.teamId };
}
