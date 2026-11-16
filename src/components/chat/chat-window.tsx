'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { parseSuggestions } from '@/lib/persona/prompt';
import { resolveChatLayout } from '@/lib/chat/layouts';
import { parseNarrative, choicesOf } from '@/lib/chat/narrative';
import { MessageBubble } from './message-bubble';
import { Composer, type PendingImage } from './composer';
import { SuggestionChips } from './suggestion-chips';
import { ImageGenerator } from './image-generator';
import type { GeneratedMessage } from '@/server/actions/images';
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
  /** Where to POST. Defaults to the customer chat route. */
  apiPath?: string;
  /** Extra fields merged into every request body — the workbench sends its category. */
  apiBody?: Record<string, unknown>;
  /** Called when a reply has finished streaming — the category agent refreshes its proposal list. */
  onFinish?: () => void;
  chatId: string;
  initialMessages: UIMessage[];
  suggestions: string[];
  personaName?: string;
  /** `persona_versions.chat_layout` — falls back to the standard layout. */
  layoutKey?: string | null;
  capabilities?: ChatCapabilities;
  locale?: string;
  /** True when ElevenLabs Scribe is configured, which makes dictation work outside Chrome. */
  serverTranscription?: boolean;
  /** Clicking a suggestion sends it at once instead of filling the box — the category agent's next steps. */
  sendOnPick?: boolean;
  /** Filled with a function that sends a message — so a plan beside the chat can say "draft this one". */
  sendRef?: MutableRefObject<((text: string) => void) | null>;
  /** Tools the model may call, by name, with what to say while each runs; tool calls are shown only when given. */
  toolLabels?: Record<string, { running: string; done: string }>;
};

type ToolPart = { type: string; state?: string; toolCallId?: string };

/** The tool calls of a message, in order: `tool-<name>` parts. */
function toolsOf(message: UIMessage): { name: string; done: boolean; failed: boolean; key: string }[] {
  return (message.parts as ToolPart[])
    .filter((part) => part.type.startsWith('tool-'))
    .map((part, index) => ({
      name: part.type.slice('tool-'.length),
      done: part.state === 'output-available' || part.state === 'output-error',
      failed: part.state === 'output-error',
      key: part.toolCallId ?? String(index),
    }));
}

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
  serverTranscription = false,
  apiPath = '/api/chat',
  apiBody,
  onFinish,
  sendOnPick = false,
  sendRef,
  toolLabels,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const layout = resolveChatLayout(layoutKey);

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    /*
     * The endpoint is a prop because the same window now serves two of them:
     * `/api/chat` for customers, and `/api/admin/workbench` for designing a bot
     * against a category brief. Those routes differ in the things that cannot be
     * a flag — one bills a wallet and authorises by chat ownership, the other
     * charges nothing and authorises by `requireAdmin` — so they stay separate
     * routes, and only the transport moves.
     */
    transport: new DefaultChatTransport({ api: apiPath, body: apiBody }),
    onFinish: onFinish ? () => onFinish() : undefined,
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
    if (sendOnPick && !busy) {
      void sendMessage({ text: value });
      return;
    }
    setDraft(value);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!sendRef) return;
    sendRef.current = (text: string) => {
      if (!busy) void sendMessage({ text });
    };
    return () => {
      sendRef.current = null;
    };
  }, [sendRef, sendMessage, busy]);

  // Appends the messages a generation just wrote. `useCallback` because it's
  // a dependency of the generator's effect — an unstable identity there would
  // re-run it on every render.
  const appendGenerated = useCallback(
    (created: GeneratedMessage[]) => {
      setMessages((current) => [
        ...current,
        ...created.map((message) => ({
          id: message.id,
          role: message.role,
          parts: [
            ...message.images.map((image) => ({ type: 'file' as const, mediaType: image.mediaType, url: image.url })),
            { type: 'text' as const, text: message.text },
          ],
        })),
      ]);
    },
    [setMessages],
  );

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
        {messages.map((message) => {
          const text = message.role === 'user' ? textOf(message) : parseSuggestions(textOf(message)).text;
          const tools = toolLabels && message.role === 'assistant' ? toolsOf(message) : [];
          return (
            <div key={message.id} className="space-y-2">
              {tools.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="What the agent did">
                  {tools.map((t) => (
                    <li
                      key={t.key}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
                        t.failed ? 'border-rose-500/30 text-rose-400' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                      )}
                    >
                      {t.done ? <Check className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
                      {t.done ? (toolLabels?.[t.name]?.done ?? t.name) : (toolLabels?.[t.name]?.running ?? t.name)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {text || imagesOf(message).length || !tools.length ? (
                <MessageBubble
                  role={message.role === 'user' ? 'user' : 'assistant'}
                  text={text}
                  chatId={chatId}
                  images={imagesOf(message)}
                  layout={layout}
                  canCopy={capabilities.copy}
                  canSpeak={capabilities.voiceOut && message.role !== 'user'}
                  onChoice={pick}
                />
              ) : null}
            </div>
          );
        })}

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
        <div className={cn('space-y-2', layout.bubbleStyle === 'document' && 'mx-auto w-full max-w-3xl')}>
          {capabilities.images ? <ImageGenerator chatId={chatId} onGenerated={appendGenerated} /> : null}

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
            chatId={chatId}
            serverTranscription={serverTranscription}
          />

          <p className="mt-2 text-center text-[11px] text-slate-400">
            Responses are generated by AI and may be inaccurate. Verify anything important.
          </p>
        </div>
      </footer>
    </section>
  );
}
