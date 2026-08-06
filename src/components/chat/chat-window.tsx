'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Send, Square } from 'lucide-react';
import { Markdown } from '@/components/site/markdown';
import { parseSuggestions } from '@/lib/persona/prompt';
import { cn } from '@/lib/utils';

export type ChatWindowProps = {
  chatId: string;
  initialMessages: UIMessage[];
  suggestions: string[];
  personaName?: string;
};

/** Extracts the plain text of a UI message across all of its parts. */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function ChatWindow({ chatId, initialMessages, suggestions, personaName }: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const busy = status === 'submitted' || status === 'streaming';

  // The system prompt asks every persona to end its reply with a trailing
  // [SUGGESTIONS: A | B | C] tag, parsed here into clickable follow-ups so
  // the conversation keeps offering next steps, not just on the first turn.
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const dynamicSuggestions = useMemo(() => {
    if (!lastAssistant || busy) return [];
    return parseSuggestions(textOf(lastAssistant)).suggestions;
  }, [lastAssistant, busy]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;

    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    void sendMessage({ text });
  }

  const hasUserMessage = messages.some((message) => message.role === 'user');

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex animate-in-up', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                message.role === 'user'
                  ? 'rounded-br-md bg-brand-600 text-white'
                  : 'rounded-bl-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{textOf(message)}</p>
              ) : (
                <Markdown className="prose-sm">{parseSuggestions(textOf(message)).text}</Markdown>
              )}
            </div>
          </div>
        ))}

        {!hasUserMessage && suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setDraft(suggestion);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-medium transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-500/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {dynamicSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {dynamicSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setDraft(suggestion);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-brand-200 bg-brand-50/60 px-3.5 py-2 text-xs font-medium text-brand-700 transition hover:border-brand-400 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:border-brand-600"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-1.5 px-1" aria-label="Generating a reply">
            <span className="size-2 animate-pulse-dot rounded-full bg-brand-500" />
            <span className="size-2 animate-pulse-dot rounded-full bg-brand-500 [animation-delay:.15s]" />
            <span className="size-2 animate-pulse-dot rounded-full bg-brand-500 [animation-delay:.3s]" />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300">
            {error.message}
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-200 p-4 dark:border-slate-800">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(event) => {
              setDraft(event.target.value);
              const el = event.target;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={
              personaName
                ? `Message ${personaName}…  (Enter to send, Shift+Enter for a new line)`
                : 'Send a message…'
            }
            className="max-h-60 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
          />

          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Stop generating"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={draft.trim().length === 0}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </button>
          )}
        </form>

        <p className="mt-2 text-center text-[11px] text-slate-400">
          Responses are generated by AI and may be inaccurate. Verify anything important.
        </p>
      </footer>
    </section>
  );
}
