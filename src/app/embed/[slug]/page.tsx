import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { db } from '@/db';
import { chats, messages, personas, personaVersions } from '@/db/schema';
import { assertChatAccess, startChatAction } from '@/server/actions/chat';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';
import { EmbedChat } from './embed-chat';
import { initialsOf } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ c?: string }>;

async function loadPersona(slug: string) {
  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.slug, slug), eq(personas.isActive, true)))
    .limit(1);
  if (!persona) return null;

  const [version] = persona.currentVersionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, persona.currentVersionId)).limit(1)
    : [undefined];

  return { persona, version };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const loaded = await loadPersona((await params).slug);
  // Never indexed: the embed is a widget, and a search result landing on a
  // chrome-less iframe page would be a dead end for the visitor.
  return { title: loaded?.persona.name ?? 'Chat', robots: { index: false, follow: false } };
}

/**
 * The embeddable widget — `<iframe src="https://host/embed/<slug>">`.
 *
 * Gated on the persona's `embed` capability: a persona that hasn't opted in
 * 404s here exactly as if the route didn't exist, so enabling embedding is a
 * deliberate per-persona decision rather than something true of every persona
 * by default.
 *
 * Deliberately two states rather than creating a chat on load. A GET that
 * writes would mean every crawler, prefetch and iframe re-render minting a
 * conversation — so the bare URL shows an intro, and the chat only exists
 * once someone presses start.
 */
export default async function EmbedPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const { c: chatId } = await searchParams;

  const loaded = await loadPersona(slug);
  if (!loaded) notFound();

  const { persona, version } = loaded;
  if (!version?.capabilities.embed) notFound();

  const layoutKey = await resolveLayoutForPersona(
    persona.id,
    version.chatLayout,
    version.audienceType,
    version.audienceSegments,
  );

  const header = (
    <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
        style={{ background: persona.accentColor }}
      >
        {initialsOf(persona.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{persona.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {persona.expertise ?? persona.tagline}
        </p>
      </div>
    </div>
  );

  // An existing conversation, but only if this visitor actually owns it —
  // assertChatAccess enforces the same guest-cookie rule as everywhere else,
  // so a guessed ?c= can't open someone else's chat.
  if (chatId) {
    const chat = await assertChatAccess(chatId);
    if (chat && chat.personaId === persona.id) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(asc(messages.position));

      const initialMessages: UIMessage[] = rows
        .filter((row) => row.role !== 'system' && row.status === 'complete')
        .map((row) => ({
          id: row.id,
          role: row.role === 'assistant' ? 'assistant' : 'user',
          parts: [{ type: 'text', text: row.content }],
        }));

      return (
        <main className="flex h-screen flex-col bg-white dark:bg-slate-950">
          {header}
          <EmbedChat
            chatId={chat.id}
            initialMessages={initialMessages}
            suggestions={version.suggestions}
            personaName={persona.name}
            layoutKey={layoutKey}
            capabilities={version.capabilities}
          />
        </main>
      );
    }
  }

  return (
    <main className="flex h-screen flex-col bg-white dark:bg-slate-950">
      {header}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
          {version.welcomeMessage ?? persona.tagline ?? `Chat with ${persona.name}.`}
        </p>
        <form action={startChatAction}>
          <input type="hidden" name="persona" value={persona.slug} />
          <input type="hidden" name="embed" value="1" />
          <button
            type="submit"
            className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Start chatting
          </button>
        </form>
      </div>
    </main>
  );
}
