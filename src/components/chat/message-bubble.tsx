'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Volume2, Loader2, ShieldAlert } from 'lucide-react';
import { speakAction } from '@/server/actions/voice';
import { Markdown } from '@/components/site/markdown';
import { NarrativeMessage } from './narrative-message';
import type { ChatLayoutConfig } from '@/lib/chat/layouts';
import { cn } from '@/lib/utils';

const DENSITY: Record<ChatLayoutConfig['density'], string> = {
  compact: 'px-3.5 py-2.5 text-[13px]',
  comfortable: 'px-4 py-3 text-sm',
  spacious: 'px-5 py-4 text-[15px] leading-relaxed',
};

/**
 * A single transcript entry. Which of the three shapes it takes is the
 * layout's call:
 *  - `bubble`   — classic chat bubbles (learning, supportive, quick help)
 *  - `document` — full-width prose, no bubble (professional, studio, narrative)
 *  - `flat`     — speaker-labelled row (rooms)
 */
export function MessageBubble({
  role,
  text,
  chatId,
  images = [],
  layout,
  speaker,
  canCopy,
  canSpeak,
  onChoice,
  isGuardrail,
}: {
  role: 'user' | 'assistant';
  text: string;
  /** Needed for read-aloud, which is an owned-conversation action because it costs money. */
  chatId?: string;
  images?: { url: string; mediaType: string }[];
  layout: ChatLayoutConfig;
  speaker?: string;
  canCopy?: boolean;
  canSpeak?: boolean;
  onChoice?: (choice: string) => void;
  isGuardrail?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUser = role === 'user';
  const showCopy = Boolean(canCopy) && layout.showCopy && !isUser && text.trim().length > 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is permission-gated and unavailable over plain http —
      // a failed copy silently does nothing rather than throwing at the user.
    }
  }

  function speakInBrowser() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  /**
   * Tries the good voice first, falls back to the browser's own.
   *
   * Losing ElevenLabs should never mean losing read-aloud — it's an
   * accessibility affordance on the Learning and Supportive layouts, not a
   * flourish. Any failure degrades to `speechSynthesis` silently.
   */
  async function speak() {
    if (!chatId) return speakInBrowser();
    setSpeaking(true);
    try {
      const form = new FormData();
      form.set('chatId', chatId);
      form.set('text', text);
      const result = await speakAction(null, form);

      if (result?.url) {
        audioRef.current?.pause();
        const audio = new Audio(result.url);
        audioRef.current = audio;
        await audio.play();
        return;
      }
      speakInBrowser();
    } catch {
      speakInBrowser();
    } finally {
      setSpeaking(false);
    }
  }

  const gallery =
    images.length > 0 ? (
      <div className={cn('flex flex-wrap gap-2', text.trim() ? 'mb-2' : '')}>
        {images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL mid-send, then a local /uploads path; next/image handles neither well here
          <img
            key={image.url}
            src={image.url}
            alt=""
            className="max-h-64 rounded-lg border border-slate-200/60 object-contain dark:border-slate-700"
          />
        ))}
      </div>
    ) : null;

  const body = isUser ? (
    <>
      {gallery}
      {text.trim() ? <p className="whitespace-pre-wrap">{text}</p> : null}
    </>
  ) : layout.narrative ? (
    <NarrativeMessage text={text} style={layout.narrative} onChoice={onChoice} />
  ) : (
    <>
      {gallery}
      <Markdown className={layout.density === 'compact' ? 'prose-sm' : 'prose-sm sm:prose-base'}>{text}</Markdown>
    </>
  );

  const actions =
    showCopy || canSpeak ? (
      <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {showCopy ? (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
        {canSpeak ? (
          <button
            type="button"
            onClick={() => void speak()}
            disabled={speaking}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {speaking ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
            {speaking ? 'Preparing…' : 'Read aloud'}
          </button>
        ) : null}
      </div>
    ) : null;

  // A guardrail response (a crisis referral, a "see a professional" redirect)
  // is the one message that must never read as just another paragraph.
  if (isGuardrail && layout.highlightGuardrails && !isUser) {
    return (
      <div className="group animate-in-up rounded-2xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-3.5" />
          Please read this carefully
        </p>
        <div className="text-sm">{body}</div>
        {actions}
      </div>
    );
  }

  if (layout.bubbleStyle === 'document' && !isUser) {
    return (
      <div className="group animate-in-up">
        {speaker ? (
          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{speaker}</p>
        ) : null}
        <div className={cn('max-w-none', layout.density === 'spacious' && 'text-[15px] leading-relaxed')}>{body}</div>
        {actions}
      </div>
    );
  }

  if (layout.bubbleStyle === 'flat') {
    return (
      <div className="group animate-in-up flex gap-3">
        <div className="min-w-0 flex-1">
          {speaker ? (
            <p className={cn('mb-0.5 text-xs font-semibold', isUser ? 'text-slate-500' : 'text-brand-600 dark:text-brand-400')}>
              {speaker}
            </p>
          ) : null}
          <div className={cn('rounded-xl border', layout.accentClass, DENSITY[layout.density])}>{body}</div>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group flex animate-in-up', isUser ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl shadow-sm',
            DENSITY[layout.density],
            isUser
              ? 'rounded-br-md bg-brand-600 text-on-brand'
              : cn('rounded-bl-md border bg-white dark:bg-slate-900', layout.accentClass),
          )}
        >
          {body}
        </div>
        {actions}
      </div>
    </div>
  );
}
