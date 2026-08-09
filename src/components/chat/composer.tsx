'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Mic, Send, Square, X } from 'lucide-react';
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

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 4;

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type PendingImage = { url: string; mediaType: string; name: string };

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  layout,
  personaName,
  canVoiceIn,
  canAttachImages,
  images,
  onImagesChange,
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
  canAttachImages?: boolean;
  images: PendingImage[];
  onImagesChange: (images: PendingImage[]) => void;
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

  // Read as data URLs on the client. The server decodes and writes them to
  // disk — but the *model* needs the bytes inline anyway, because a provider
  // cannot fetch a URL on this host. See docs/26-vision-and-images.md.
  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(list).slice(0, Math.max(0, room));

    const read = await Promise.all(
      picked
        .filter((file) => ALLOWED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES)
        .map(
          (file) =>
            new Promise<PendingImage | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ url: String(reader.result), mediaType: file.type, name: file.name });
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            }),
        ),
    );

    onImagesChange([...images, ...read.filter((i): i is PendingImage => i !== null)]);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      {images.length > 0 ? (
        <div className="mb-2 flex w-full flex-wrap gap-2">
          {images.map((image, i) => (
            <span key={`${image.name}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview, never a remote asset */}
              <img src={image.url} alt={image.name} className="size-16 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              <button
                type="button"
                onClick={() => onImagesChange(images.filter((_, index) => index !== i))}
                aria-label={`Remove ${image.name}`}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-slate-800 text-white"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

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

      {canAttachImages ? (
        <label
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          title="Attach an image"
        >
          <ImagePlus className="size-4" />
          <input
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      ) : null}

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
