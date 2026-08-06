import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { chats, personas } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { startChatAction } from '@/server/actions/chat';
import { initialsOf } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Chat' };

export async function loadChatList() {
  const user = await currentUser();
  const guest = (await cookies()).get('aigency_guest')?.value;

  const ownership = user
    ? eq(chats.userId, user.id)
    : guest
      ? and(isNull(chats.userId), eq(chats.guestToken, guest))
      : undefined;

  if (!ownership) return [];

  return db
    .select({
      id: chats.id,
      title: chats.title,
      lastMessageAt: chats.lastMessageAt,
      messagesCount: chats.messagesCount,
      personaName: personas.name,
      personaColor: personas.accentColor,
    })
    .from(chats)
    .leftJoin(personas, eq(personas.id, chats.personaId))
    .where(ownership)
    .orderBy(desc(chats.lastMessageAt))
    .limit(50);
}

export default async function ChatIndexPage() {
  const [list, starters] = await Promise.all([
    loadChatList(),
    db.select().from(personas).where(eq(personas.isActive, true)).orderBy(personas.position).limit(6),
  ]);

  return (
    <div className="container-app py-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ChatSidebar chats={list} />

        <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Sparkles className="size-8" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Pick a persona to begin</h1>
          <p className="mt-2 max-w-md text-slate-500 dark:text-slate-400">
            Every persona brings its own expertise and personality. Choose one below or browse the full
            gallery.
          </p>

          <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((persona) => (
              <form key={persona.id} action={startChatAction}>
                <input type="hidden" name="persona" value={persona.slug} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-500/5"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                    style={{ background: persona.accentColor }}
                  >
                    {initialsOf(persona.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{persona.name}</span>
                    <span className="block truncate text-xs text-slate-400">{persona.expertise}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>

          <Link href="/personas" className="mt-8 text-sm font-semibold text-brand-600 hover:underline">
            Browse all personas →
          </Link>
        </div>
      </div>
    </div>
  );
}
