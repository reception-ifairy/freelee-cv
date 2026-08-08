'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { chats, messages, personas, personaVersions } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { resolveChatTeamId } from '@/lib/teams';

const GUEST_COOKIE = 'aigency_guest';

/** Stable identifier for signed-out visitors so their chats survive a refresh. */
export async function guestToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) return existing;

  const token = randomUUID();
  store.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return token;
}

export async function startChatAction(formData: FormData) {
  const slug = z.string().min(1).parse(formData.get('persona'));

  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.slug, slug), eq(personas.isActive, true)))
    .limit(1);

  if (!persona) redirect('/personas');

  const user = await currentUser();

  // Content (welcomeMessage, etc.) lives on persona_versions since Phase 4
  // (docs/11-persona-versioning.md). personaVersionId is only pinned here
  // when the persona opted into it (pinVersioning=true) — otherwise it's
  // left null and src/app/api/chat/route.ts always resolves the *current*
  // version live, so an admin editing a persona takes effect on every
  // existing conversation immediately, not just new ones (same behavior as
  // before this table existed).
  const [version] = persona.currentVersionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, persona.currentVersionId)).limit(1)
    : [undefined];

  const [chat] = await db
    .insert(chats)
    .values({
      userId: user?.id ?? null,
      teamId: await resolveChatTeamId(user?.id),
      personaId: persona.id,
      personaVersionId: persona.pinVersioning ? (persona.currentVersionId ?? null) : null,
      guestToken: user ? null : await guestToken(),
    })
    .returning();

  if (version?.welcomeMessage) {
    await db.insert(messages).values({
      chatId: chat.id,
      role: 'assistant',
      content: version.welcomeMessage,
      position: 0,
      status: 'complete',
    });

    await db.update(chats).set({ messagesCount: 1 }).where(eq(chats.id, chat.id));
  }

  await db
    .update(personas)
    .set({ chatsCount: persona.chatsCount + 1 })
    .where(eq(personas.id, persona.id));

  redirect(`/chat/${chat.id}`);
}

/** Shared ownership check used by every chat mutation and by the API route. */
export async function assertChatAccess(chatId: string) {
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (!chat) return null;

  const user = await currentUser();

  if (chat.userId) return user?.id === chat.userId ? chat : null;

  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return token && chat.guestToken === token ? chat : null;
}

export async function deleteChatAction(formData: FormData) {
  const chatId = z.string().min(1).parse(formData.get('chatId'));
  const chat = await assertChatAccess(chatId);
  if (!chat) return;

  await db.delete(chats).where(eq(chats.id, chatId));
  revalidatePath('/chat');
  redirect('/chat');
}

export async function shareChatAction(formData: FormData) {
  const chatId = z.string().min(1).parse(formData.get('chatId'));
  const chat = await assertChatAccess(chatId);
  if (!chat) return;

  const token = chat.shareToken ?? randomUUID().replace(/-/g, '');
  await db.update(chats).set({ isShared: true, shareToken: token }).where(eq(chats.id, chatId));
  revalidatePath(`/chat/${chatId}`);
}

const styleSchema = z.enum(['formal', 'casual', 'enthusiastic', 'concise', 'socratic']).nullable();
const unknownSchema = z.enum(['admit_ignorance', 'educated_guess', 'ask_clarifying']).nullable();

/** '' from an unset <select> means "inherit from the persona" — stored as NULL, not as a value. */
function optionalEnum<T extends z.ZodTypeAny>(schema: T, raw: FormDataEntryValue | null) {
  const value = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  const parsed = schema.safeParse(value);
  return parsed.success ? (parsed.data as z.infer<T>) : null;
}

/**
 * The conversation controls (docs/24-chat-controls.md) — tone/writing/output/
 * length modifiers plus per-chat overrides of the persona's interaction style
 * and how it handles things it doesn't know.
 *
 * One action for all of them because they're one form: the user adjusts a few
 * dials and applies them together, and splitting it would mean several
 * round-trips to change what reads as a single setting.
 */
export async function setChatControlsAction(formData: FormData) {
  const chatId = z.string().min(1).parse(formData.get('chatId'));
  const chat = await assertChatAccess(chatId);
  if (!chat) return;

  // Every unset dropdown submits '' — and `Number('')` is 0, which
  // `Number.isFinite` happily accepts. The previous version therefore stored
  // a bogus modifier id 0 for each control the user left alone, so a chat
  // with one real choice came back reporting four. Filter on the raw string
  // first, and require a positive id (serial primary keys start at 1).
  const ids = formData
    .getAll('modifierIds')
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

  await db
    .update(chats)
    .set({
      modifierIds: ids,
      interactionStyle: optionalEnum(styleSchema, formData.get('interactionStyle')),
      approachToUnknown: optionalEnum(unknownSchema, formData.get('approachToUnknown')),
    })
    .where(eq(chats.id, chatId));

  revalidatePath(`/chat/${chatId}`);
}

/** @deprecated Kept as a thin alias so any existing caller keeps working — use setChatControlsAction. */
export async function setChatModifiersAction(formData: FormData) {
  return setChatControlsAction(formData);
}
