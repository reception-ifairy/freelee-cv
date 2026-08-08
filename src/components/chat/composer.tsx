'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import type { ChatLayoutConfig } from '@/lib/chat/layouts';
import { cn } from '@/lib/utils';

/** The browser speech-recognition handle, which is still vendor-prefixed in Chrome and absent in Firefox/Safari. */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  layout,
  personaName,
  canVoiceIn,
  locale = 'en-GB',
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  layout: ChatLayoutConfig;
  personaName?: string;
  canVoiceIn?: boolean;
  locale?: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Feature-detected after mount, never during render — the server has no
  // `window`, and a mismatch here would be a hydration error.
  useEffect(() => {
    setVoiceAvailable(Boolean(canVoiceIn) && speechRecognitionCtor() !== null);
  }, [canVoiceIn]);

  function toggleListening() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript).join(' ');
      onChange(value ? `${value} ${transcript}` : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const placeholder = layout.placeholder.replace('{name}', personaName ?? 'the assistant');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        ref={inputRef}
        value={value}
        rows={1}
        onChange={(event) => {
          onChange(event.target.value);
          const el = event.target;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className={cn(
          'max-h-60 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900',
          layout.density === 'spacious' ? 'text-[15px]' : 'text-sm',
        )}
      />

      {voiceAvailable ? (
        <button
          type="button"
          onClick={toggleListening}
          aria-label={listening ? 'Stop dictating' : 'Dictate a message'}
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl border transition',
            listening
              ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-500/10'
              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
          )}
        >
          <Mic className="size-4" />
        </button>
      ) : null}

      {busy ? (
        <button
          type="button"
          onClick={onStop}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label="Stop generating"
        >
          <Square className="size-4" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={value.trim().length === 0}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      )}
    </form>
  );
}
