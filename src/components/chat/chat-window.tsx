'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { parseSuggestions } from '@/lib/persona/prompt';
import { resolveChatLayout } from '@/lib/chat/layouts';
import { parseNarrative, choicesOf } from '@/lib/chat/narrative';
import { MessageBubble } from './message-bubble';
import { Composer, type PendingImage } from './composer';
import { SuggestionChips } from './suggestion-chips';
import { cn } from '@/lib/utils';

export type ChatCapabilities = {
  copy?: boolean;
  share?: boolean;
  suggestions?: boolean;
  voiceIn?: boolean;
  voiceOut?: boolean;
  vision?: boolean;
  images?: boolean;
};

export type ChatWindowProps = {
  chatId: string;
  initialMessages: UIMessage[];
  suggestions: string[];
  personaName?: string;
  /** `persona_versions.chat_layout` — falls back to the standard layout. */
  layoutKey?: string | null;
  capabilities?: ChatCapabilities;
  locale?: string;
};

/** Image parts of a message — uploads on the way in, generated images on the way back. */
function imagesOf(message: UIMessage): { url: string; mediaType: string }[] {
  return message.parts
    .filter(
      (part): part is { type: 'file'; mediaType: string; url: string } =>
        part.type === 'file' && typeof (part as { url?: unknown }).url === 'string',
    )
    .map((part) => ({ url: part.url, mediaType: part.mediaType }));
}

/** Extracts the plain text of a UI message across all of its parts. */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function ChatWindow({
  chatId,
  initialMessages,
  suggestions,
  personaName,
  layoutKey,
  capabilities = {},
  locale = 'en-GB',
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const layout = resolveChatLayout(layoutKey);

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

  // A gamebook's numbered choices are its follow-ups — they're rendered
  // inside the message itself, so the chip row would be a duplicate.
  const hasInlineChoices = useMemo(() => {
    if (layout.narrative !== 'gamebook' || !lastAssistant || busy) return false;
    return choicesOf(parseNarrative(parseSuggestions(textOf(lastAssistant)).text, 'gamebook')).length > 0;
  }, [layout.narrative, lastAssistant, busy]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function pick(value: string) {
    setDraft(value);
    inputRef.current?.focus();
  }

  function submit() {
    const text = draft.trim();
    // An image on its own is a legitimate message — "what is this?" is often
    // the whole question — so only block when there's nothing at all.
    if ((!text && pendingImages.length === 0) || busy) return;

    const files = pendingImages.map((image) => ({
      type: 'file' as const,
      mediaType: image.mediaType,
      url: image.url,
    }));

    setDraft('');
    setPendingImages([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    void sendMessage({ text, files });
  }

  const hasUserMessage = messages.some((message) => message.role === 'user');
  const showStarters = !hasUserMessage && capabilities.suggestions !== false;

  return (
    <section className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        ref={scrollerRef}
        className={cn(
          'flex-1 overflow-y-auto',
          layout.density === 'spacious' ? 'space-y-6 px-6 py-7' : 'space-y-4 px-5 py-6',
          layout.bubbleStyle === 'document' && 'mx-auto w-full max-w-3xl',
        )}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role === 'user' ? 'user' : 'assistant'}
            text={message.role === 'user' ? textOf(message) : parseSuggestions(textOf(message)).text}
            images={imagesOf(message)}
            layout={layout}
            canCopy={capabilities.copy}
            canSpeak={capabilities.voiceOut && message.role !== 'user'}
            onChoice={pick}
          />
        ))}

        {showStarters ? (
          <SuggestionChips suggestions={suggestions} layout={layout} onPick={pick} />
        ) : null}

        {!hasInlineChoices && capabilities.suggestions !== false ? (
          <SuggestionChips suggestions={dynamicSuggestions} layout={layout} onPick={pick} variant="followup" />
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
        <div className={cn(layout.bubbleStyle === 'document' && 'mx-auto w-full max-w-3xl')}>
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={stop}
            busy={busy}
            layout={layout}
            personaName={personaName}
            canVoiceIn={capabilities.voiceIn}
            canAttachImages={capabilities.vision}
            images={pendingImages}
            onImagesChange={setPendingImages}
            locale={locale}
            inputRef={inputRef}
          />

          <p className="mt-2 text-center text-[11px] text-slate-400">
            Responses are generated by AI and may be inaccurate. Verify anything important.
          </p>
        </div>
      </footer>
    </section>
  );
}
