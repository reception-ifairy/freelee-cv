'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The "?" affordance used across the app — click for a short explanation.
 *
 * `videoUrl` is the forward-looking half (see `src/lib/help/topics.ts`): when
 * an admin has attached an instructional video to this topic, the popover
 * renders it above the text. Until then — which is every topic today — the
 * slot is simply absent. No placeholder, no "video coming soon", nothing that
 * promises something that isn't there.
 */
export function HelpTip({
  title,
  body,
  videoUrl,
  className,
  side = 'right',
}: {
  title: string;
  body: string;
  videoUrl?: string | null;
  className?: string;
  side?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={title}
        aria-expanded={open}
        className="inline-grid size-4 place-items-center rounded-full text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-400"
      >
        <HelpCircle className="size-4" />
      </button>

      {open ? (
        <span
          role="dialog"
          className={cn(
            'animate-slide-up absolute top-6 z-40 block w-72 rounded-card border border-slate-200 bg-white p-4 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900',
            side === 'right' ? 'left-0' : 'right-0',
          )}
        >
          <span className="mb-1.5 flex items-start justify-between gap-2">
            <strong className="text-sm font-semibold">{title}</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="size-3.5" />
            </button>
          </span>

          {videoUrl ? (
            <span className="mb-2 block overflow-hidden rounded-lg">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- admin-supplied instructional clip; captions are the uploader's responsibility */}
              <video src={videoUrl} controls preload="metadata" className="w-full" />
            </span>
          ) : null}

          <span className="block text-xs leading-relaxed text-slate-600 dark:text-slate-300">{body}</span>
        </span>
      ) : null}
    </span>
  );
}
