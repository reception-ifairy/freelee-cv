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
import { getSiteAssistant } from '@/lib/assistant/config';
import { checkRateLimit } from '@/lib/rate-limit';

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

type PersonaRow = typeof personas.$inferSelect;

/**
 * Creates a conversation for a persona and returns it.
 *
 * Extracted from `startChatAction` so callers that must not navigate — the
 * assistant bubble, which lives on whatever page the visitor is already
 * reading — can reuse the exact same creation path. Everything that made the
 * original correct (version pinning, welcome message, counters, guest token)
 * lives here, so the two cannot drift.
 */
async function createChatForPersona(persona: PersonaRow) {
  const user = await currentUser();

  // Content (welcomeMessage, etc.) lives on persona_versions since Phase 4
  // (docs/11-persona-versioning.md). personaVersionId is only pinned here
  // when the persona opted into it (pinVersioning=true) — otherwise it's
  // left null and src/app/api/chat/route.ts always resolves the *current*
  // version live, so an admin editing a persona takes effect on every
  // existing conversation immediately, not just new ones.
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

  return { chat, welcome: version?.welcomeMessage ?? null };
}

export async function startChatAction(formData: FormData) {
  const slug = z.string().min(1).parse(formData.get('persona'));
  // Set by the embed page so the new chat opens inside the iframe rather than
  // navigating the host site's top-level window to /chat/<id>.
  const embed = formData.get('embed') === '1';

  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.slug, slug), eq(personas.isActive, true)))
    .limit(1);

  if (!persona) redirect('/personas');

  const { chat } = await createChatForPersona(persona);
  redirect(embed ? `/embed/${persona.slug}?c=${chat.id}` : `/chat/${chat.id}`);
}

/**
 * Starts an assistant conversation and returns its id instead of redirecting.
 *
 * The persona is resolved from the **setting**, never from the caller: the
 * bubble cannot be pointed at an arbitrary (paid) persona by editing a request.
 */
export async function startAssistantChatAction(): Promise<{ chatId: string; welcome: string | null } | { error: string }> {
  const assistant = await getSiteAssistant();
  if (!assistant) return { error: 'The assistant is not available right now.' };

  // One conversation per visitor per window — creating chats is the cheap part,
  // but an unauthenticated endpoint that writes rows still needs a ceiling.
  const user = await currentUser();
  const gate = checkRateLimit({
    name: 'assistant-start',
    key: user?.id ?? (await guestToken()),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!gate.ok) return { error: 'Too many conversations started. Please try again later.' };

  const [persona] = await db.select().from(personas).where(eq(personas.id, assistant.personaId)).limit(1);
  if (!persona) return { error: 'The assistant is not available right now.' };

  const { chat, welcome } = await createChatForPersona(persona);
  return { chatId: chat.id, welcome };
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
