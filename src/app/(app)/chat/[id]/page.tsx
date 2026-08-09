import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Share2, Trash2, Zap } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { db } from '@/db';
import { messages, personas, personaVersions, promptModifiers } from '@/db/schema';
import { assertChatAccess, deleteChatAction, shareChatAction } from '@/server/actions/chat';
import { currentUser } from '@/lib/auth';
import { getBalanceForTeam } from '@/lib/billing/credits';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatWindow } from '@/components/chat/chat-window';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';
import { ChatControls } from '@/components/chat/chat-controls';
import { ImageGenerator } from '@/components/chat/image-generator';
import { loadChatList } from '../page';
import { formatCredits, initialsOf } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Chat' };

type Params = Promise<{ id: string }>;

export default async function ChatPage({ params }: { params: Params }) {
  const { id } = await params;

  const chat = await assertChatAccess(id);
  if (!chat) notFound();

  const [rows, personaRows, list, user] = await Promise.all([
    db.select().from(messages).where(eq(messages.chatId, id)).orderBy(asc(messages.position)),
    chat.personaId
      ? db.select().from(personas).where(eq(personas.id, chat.personaId)).limit(1)
      : Promise.resolve([]),
    loadChatList(),
    currentUser(),
  ]);

  const persona = personaRows[0];

  const versionId = chat.personaVersionId ?? persona?.currentVersionId;
  const [version] = versionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, versionId)).limit(1)
    : [undefined];

  // See src/components/site/header.tsx for why this guards on defaultTeamId
  // itself, not just on `user` — a stale JWT session cookie can have it undefined.
  const balance = user?.defaultTeamId ? await getBalanceForTeam(user.defaultTeamId) : undefined;

  const layoutKey = await resolveLayoutForPersona(
    chat.personaId,
    version?.chatLayout,
    version?.audienceType,
    version?.audienceSegments,
  );
  const capabilities = version?.capabilities ?? {};

  // Only loaded when the persona actually offers at least one of the
  // format controls — no point querying the table for a persona that
  // exposes none of them.
  const offersModifiers = Boolean(capabilities.tone || capabilities.writing || capabilities.output);
  const modifierRows = offersModifiers
    ? await db
        .select({ id: promptModifiers.id, type: promptModifiers.type, name: promptModifiers.name })
        .from(promptModifiers)
        .where(eq(promptModifiers.isActive, true))
        .orderBy(promptModifiers.position)
    : [];

  // Persisted rows are replayed into the shape the AI SDK expects on the client.
  // Attachments are replayed as file parts so an uploaded or generated image
  // survives a page reload instead of leaving a message that references a
  // picture nobody can see.
  const initialMessages: UIMessage[] = rows
    .filter((row) => row.role !== 'system' && row.status === 'complete')
    .map((row) => ({
      id: row.id,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      parts: [
        ...row.attachments.map((file) => ({ type: 'file' as const, mediaType: file.mediaType, url: file.url })),
        { type: 'text' as const, text: row.content },
      ],
    }));

  return (
    <div className="container-app py-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ChatSidebar chats={list} activeId={id} />

        <div className="space-y-3">
          <header className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {persona ? (
              <>
                <span
                  className="grid size-10 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ background: persona.accentColor }}
                >
                  {initialsOf(persona.name)}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate font-semibold leading-tight">{persona.name}</h1>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {persona.expertise ?? persona.tagline}
                  </p>
                </div>
              </>
            ) : (
              <h1 className="font-semibold">{chat.title ?? 'Conversation'}</h1>
            )}

            <div className="ml-auto flex items-center gap-1">
              {user ? (
                <span className="mr-2 hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:inline-flex">
                  <Zap className="size-3.5 text-accent-500" />
                  {formatCredits(balance ?? 0)}
                </span>
              ) : null}

              {capabilities.share !== false ? (
                <form action={shareChatAction}>
                  <input type="hidden" name="chatId" value={chat.id} />
                  <button
                    type="submit"
                    className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Share conversation"
                  >
                    <Share2 className="size-4" />
                  </button>
                </form>
              ) : null}

              <form action={deleteChatAction}>
                <input type="hidden" name="chatId" value={chat.id} />
                <button
                  type="submit"
                  className="grid size-9 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  title="Delete conversation"
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            </div>
          </header>

          {capabilities.images ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <ImageGenerator chatId={chat.id} />
            </div>
          ) : null}

          <ChatControls
            chatId={chat.id}
            modifiers={modifierRows}
            selectedModifierIds={chat.modifierIds}
            interactionStyle={chat.interactionStyle}
            approachToUnknown={chat.approachToUnknown}
            show={{ tone: capabilities.tone, writing: capabilities.writing, output: capabilities.output }}
          />

          <ChatWindow
            chatId={chat.id}
            initialMessages={initialMessages}
            suggestions={version?.suggestions ?? []}
            personaName={persona?.name}
            layoutKey={layoutKey}
            capabilities={capabilities}
          />
        </div>
      </div>
    </div>
  );
}
