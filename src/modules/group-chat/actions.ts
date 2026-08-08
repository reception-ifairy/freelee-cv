'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  conversations, conversationParticipants, conversationMessages,
  personas, users, teamMembers,
} from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertModuleEnabled } from '@/lib/modules/db';
import { slugify } from '@/lib/utils';
import { parseMentions, runMentionedTurns, reserveNextPosition, DEFAULT_MAX_PERSONAS_PER_ROOM } from './mentions';
import { notifyConversation } from './realtime';
import { layoutsForSurface } from '@/lib/chat/layouts';

const MODULE_KEY = 'group-chat';

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

/** Every conversation gets a placeholder id up front so participant handles can be reserved against it before the row exists in the usual sense — simpler: create the conversation, then participants, in one transaction. */
export async function createRoomAction(formData: FormData) {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await assertModuleEnabled(teamId, MODULE_KEY);

  const title = z.string().trim().max(120).optional().parse(formData.get('title') || undefined);
  const personaIds = formData
    .getAll('personaIds')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  const selectedPersonas = personaIds.length
    ? await db.select().from(personas).where(and(eq(personas.teamId, teamId)))
    : [];
  const wanted = new Set(personaIds);
  const personasToAdd = selectedPersonas.filter((p) => wanted.has(p.id));

  const conversationId = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({ teamId, kind: 'room', title: title || null, createdBy: user.id })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values({
      conversationId: conversation.id,
      participantType: 'user',
      participantId: user.id,
      role: 'owner',
      displayName: user.name ?? 'You',
      mentionHandle: await uniqueHandle(conversation.id, user.name ?? user.id.slice(0, 8)),
    });

    for (const persona of personasToAdd) {
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

    return conversation.id;
  });

  revalidatePath('/rooms');
  redirect(`/rooms/${conversationId}`);
}

const addPersonaSchema = z.object({ conversationId: z.string().min(1), personaId: z.coerce.number().int() });

export async function addPersonaToRoomAction(formData: FormData) {
  const user = await requireUser();
  const parsed = addPersonaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { conversationId, personaId } = parsed.data;
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return;
  await assertModuleEnabled(conversation.teamId, MODULE_KEY);
  await assertParticipant(conversationId, user.id);

  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.id, personaId), eq(personas.teamId, conversation.teamId)))
    .limit(1);
  if (!persona) return;

  await db
    .insert(conversationParticipants)
    .values({
      conversationId,
      participantType: 'persona',
      participantId: String(persona.id),
      personaVersionId: persona.currentVersionId,
      role: 'editor',
      displayName: persona.name,
      mentionHandle: await uniqueHandle(conversationId, persona.slug),
    })
    .onConflictDoNothing();

  revalidatePath(`/rooms/${conversationId}`);
}

const addUserSchema = z.object({ conversationId: z.string().min(1), userId: z.string().min(1) });

export async function addUserToRoomAction(formData: FormData) {
  const user = await requireUser();
  const parsed = addUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { conversationId, userId: invitedUserId } = parsed.data;
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return;
  await assertModuleEnabled(conversation.teamId, MODULE_KEY);
  await assertParticipant(conversationId, user.id);

  // Only existing team members can be added — no separate room-invite flow;
  // see docs/13-group-chat.md.
  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, conversation.teamId), eq(teamMembers.userId, invitedUserId)))
    .limit(1);
  if (!member) return;

  const [invited] = await db.select().from(users).where(eq(users.id, invitedUserId)).limit(1);
  if (!invited) return;

  await db
    .insert(conversationParticipants)
    .values({
      conversationId,
      participantType: 'user',
      participantId: invited.id,
      role: 'editor',
      displayName: invited.name,
      mentionHandle: await uniqueHandle(conversationId, invited.name),
    })
    .onConflictDoNothing();

  revalidatePath(`/rooms/${conversationId}`);
}

/** Shared ownership check — mirrors src/server/actions/chat.ts's assertChatAccess() for the room world. */
export async function assertParticipant(conversationId: string, userId: string) {
  const [row] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.participantType, 'user'),
        eq(conversationParticipants.participantId, userId),
      ),
    )
    .limit(1);

  if (!row) throw new Error('FORBIDDEN');
}

const postMessageSchema = z.object({ conversationId: z.string().min(1), content: z.string().trim().min(1).max(8000) });

export async function postMessageAction(formData: FormData) {
  const user = await requireUser();
  const parsed = postMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { conversationId, content } = parsed.data;
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return;

  await assertModuleEnabled(conversation.teamId, MODULE_KEY);
  await assertParticipant(conversationId, user.id);

  const participants = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));

  const position = await reserveNextPosition(conversationId);

  const [userMessage] = await db
    .insert(conversationMessages)
    .values({ conversationId, authorType: 'user', authorId: user.id, content, position, status: 'complete' })
    .returning();

  await notifyConversation(conversationId, { type: 'message.created', messageId: userMessage.id });

  const maxPersonas = Number(conversation.settings.maxPersonasPerRoom) || DEFAULT_MAX_PERSONAS_PER_ROOM;
  const mentioned = parseMentions(content, participants, maxPersonas);

  if (mentioned.length > 0) {
    // Waits for every mentioned persona's (non-streaming) reply before
    // returning — see docs/13-group-chat.md on why rooms don't stream
    // token-by-token the way direct 1:1 chat does.
    await runMentionedTurns(conversationId, conversation.teamId, mentioned, user.id);
  }

  revalidatePath(`/rooms/${conversationId}`);
}

const roomLayoutSchema = z.object({
  conversationId: z.string().min(1),
  chatLayout: z.string().trim(),
});

/**
 * Sets a room's chat layout. Stored in `conversations.settings` (jsonb)
 * rather than a dedicated column — that bag already exists for per-room
 * overrides like `maxPersonasPerRoom`, so this needed no migration.
 *
 * Only group-surface layouts are accepted: a room rendered with a solo
 * layout would drop the speaker labels that make a multi-participant
 * transcript readable at all.
 */
export async function setRoomLayoutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { conversationId, chatLayout } = roomLayoutSchema.parse(Object.fromEntries(formData));
  await assertParticipant(conversationId, user.id);

  const allowed = new Set(layoutsForSurface('group').map((l) => l.key));
  if (!allowed.has(chatLayout as never)) return;

  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return;

  await db
    .update(conversations)
    .set({ settings: { ...conversation.settings, chatLayout } })
    .where(eq(conversations.id, conversationId));

  revalidatePath(`/rooms/${conversationId}`);
}
