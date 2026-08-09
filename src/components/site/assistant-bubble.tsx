'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { UIMessage } from 'ai';
import { Loader2, MessageCircle, Minus, X } from 'lucide-react';
import { ChatWindow, type ChatCapabilities } from '@/components/chat/chat-window';
import { startAssistantChatAction } from '@/server/actions/chat';
import { cn } from '@/lib/utils';

export type AssistantBubbleProps = {
  name: string;
  label: string;
  initials: string;
  accentColor: string;
  avatar: string | null;
  tagline: string | null;
  welcome: string | null;
  suggestions: string[];
  capabilities: ChatCapabilities;
  layoutKey: string | null;
  serverTranscription: boolean;
};

/**
 * The site assistant, as a floating panel.
 *
 * It renders `ChatWindow` — the same component the full chat page and the
 * embed widget use — so tools, voice, suggestions, markdown, moderation and
 * the persona's chat layout all work here on day one. Only the sizing differs,
 * the same trick `embed-chat.tsx` uses.
 *
 * The conversation is created on the **first message**, not on open. A chat
 * per idle click would fill the table with empty rows, which is the same
 * reasoning already written into the embed page: a GET that writes means every
 * crawler and prefetch mints a conversation.
 */
export function AssistantBubble({
  name, label, initials, accentColor, avatar, tagline,
  welcome, suggestions, capabilities, layoutKey, serverTranscription,
}: AssistantBubbleProps) {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes the panel from anywhere inside it, matching every other
  // dismissible surface on the site.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function begin() {
    if (chatId || starting) return;
    setError(null);
    startTransition(async () => {
      const result = await startAssistantChatAction();
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setChatId(result.chatId);
    });
  }

  const initialMessages: UIMessage[] = welcome
    ? [{ id: 'assistant-welcome', role: 'assistant', parts: [{ type: 'text', text: welcome }] }]
    : [];

  return (
    <>
      {/* Launcher. Hidden while the panel is open so the two never overlap on a phone. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${label} — chat with ${name}`}
          className="fixed bottom-4 right-4 z-[120] inline-flex items-center gap-2.5 rounded-full py-3 pl-3 pr-5 text-sm font-semibold text-white shadow-2xl transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          style={{ background: accentColor }}
        >
          <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-xs font-bold">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, same convention as persona avatars elsewhere
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <MessageCircle className="size-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Chat with ${name}`}
          className={cn(
            'fixed z-[120] flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900',
            // Full-screen on a phone, a panel on anything larger — a 380px
            // window on a 360px screen is unusable.
            'inset-0 rounded-none sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(38rem,calc(100vh-3rem))] sm:w-[24rem] sm:rounded-2xl',
          )}
        >
          <header className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: accentColor }}>
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-xs font-bold">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{name}</span>
              {tagline ? <span className="block truncate text-xs opacity-80">{tagline}</span> : null}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimise" className="grid size-8 place-items-center rounded-lg hover:bg-white/15">
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                // Deliberately keeps `chatId`: reopening continues the same
                // conversation rather than silently starting a new one and
                // losing what was already said.
              }}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg hover:bg-white/15 sm:hidden"
            >
              <X className="size-4" />
            </button>
          </header>

          {error ? (
            <p role="status" className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          {chatId ? (
            <div className="flex-1 overflow-hidden [&>section]:h-full [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">
              <ChatWindow
                chatId={chatId}
                initialMessages={initialMessages}
                suggestions={suggestions}
                personaName={name}
                layoutKey={layoutKey}
                capabilities={capabilities}
                serverTranscription={serverTranscription}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto p-4">
              {welcome ? (
                <p className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm dark:bg-slate-800">{welcome}</p>
              ) : null}

              {suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={begin}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={begin}
                disabled={starting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ background: accentColor }}
              >
                {starting ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                {starting ? 'Starting…' : 'Start the conversation'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
