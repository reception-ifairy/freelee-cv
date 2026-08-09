'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { COLUMNS_CLASS, type BlockLayout } from '@/lib/blocks/layout';
import { cn } from '@/lib/utils';

export type ShowcasePiece = {
  id: number;
  title: string;
  caption: string | null;
  mediaUrl: string;
  prompt: string | null;
  showPrompt: boolean;
  personaName: string | null;
  personaSlug: string | null;
  accentColor: string | null;
};

/**
 * The showcase gallery.
 *
 * A client component because of the lightbox — everything else about a block is
 * server-rendered, but "click a tile, see it large with the ask that produced
 * it" needs state. The data is still fetched on the server and passed in.
 *
 * Showing the ask is what turns a wall of pictures into a demonstration of the
 * product, and the persona link turns it into a route into the product.
 */
export function ShowcaseGallery({
  pieces,
  layout,
  title,
  subtitle,
}: {
  pieces: ShowcasePiece[];
  layout: BlockLayout;
  title?: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState<ShowcasePiece | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (pieces.length === 0) return null;

  return (
    <>
      {title || subtitle ? (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title ? <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2> : null}
          {subtitle ? <p className="mt-3 text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
      ) : null}

      <div className={cn('grid gap-4', COLUMNS_CLASS[layout.columns])}>
        {pieces.map((piece) => (
          <button
            key={piece.id}
            type="button"
            onClick={() => setOpen(piece)}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 text-left transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-curated URL, may be external */}
            <img src={piece.mediaUrl} alt={piece.title} loading="lazy" className="aspect-square w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
              <span className="block truncate text-sm font-semibold text-white">{piece.title}</span>
              {piece.personaName ? (
                <span className="block truncate text-xs text-white/70">by {piece.personaName}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 sm:p-8">
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="fixed inset-0 cursor-default" />

          <div role="dialog" aria-modal="true" aria-label={open.title} className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="size-4" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element -- admin-curated URL */}
            <img src={open.mediaUrl} alt={open.title} className="max-h-[65vh] w-full bg-slate-100 object-contain dark:bg-slate-800" />

            <div className="space-y-3 p-5">
              <div>
                <h3 className="text-lg font-bold tracking-tight">{open.title}</h3>
                {open.caption ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{open.caption}</p> : null}
              </div>

              {open.showPrompt && open.prompt ? (
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What was asked for</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{open.prompt}</p>
                </div>
              ) : null}

              {open.personaSlug ? (
                <Link
                  href={`/personas/${open.personaSlug}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-110"
                  style={{ background: open.accentColor ?? '#6366f1' }}
                >
                  Work with {open.personaName}
                  <ArrowUpRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
