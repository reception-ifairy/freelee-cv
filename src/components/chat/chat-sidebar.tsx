import Link from 'next/link';
import { MessageSquare, Plus } from 'lucide-react';
import type { Chat } from '@/db/schema';
import { cn, relativeTime, truncate } from '@/lib/utils';

type Item = Pick<Chat, 'id' | 'title' | 'lastMessageAt' | 'messagesCount'> & {
  personaName: string | null;
  personaColor: string | null;
};

export function ChatSidebar({ chats, activeId }: { chats: Item[]; activeId?: string }) {
  return (
    <aside className="flex h-fit max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:sticky lg:top-24 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <Link
          href="/personas"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
        >
          <Plus className="size-4" />
          New conversation
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">No conversations yet.</p>
        ) : (
          chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                chat.id === activeId
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
                style={{ background: chat.personaColor ?? '#94a3b8' }}
                aria-hidden="true"
              >
                <MessageSquare className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {chat.title ?? truncate(chat.personaName, 24) ?? 'New chat'}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {relativeTime(chat.lastMessageAt)}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}
