'use client';

import { Markdown } from '@/components/site/markdown';
import { parseNarrative } from '@/lib/chat/narrative';
import type { NarrativeStyle } from '@/lib/chat/layouts';
import { cn } from '@/lib/utils';

/**
 * Renders a narrative reply as distinct blocks — narration, named dialogue,
 * action beats, scene headings, choices — instead of one undifferentiated
 * markdown blob. Pairs with `narrativePromptFragment()`, which is what asks
 * the model to emit this structure in the first place.
 *
 * `onChoice` turns a gamebook's numbered choices into tappable buttons that
 * fill the composer, reusing the same "fill, don't auto-send" behaviour the
 * suggestion chips already have — a choice is still an editable intention,
 * not a committed move.
 */
export function NarrativeMessage({
  text,
  style,
  onChoice,
}: {
  text: string;
  style: NarrativeStyle;
  onChoice?: (choice: string) => void;
}) {
  const blocks = parseNarrative(text, style);
  const isScreenplay = style === 'screenplay';

  return (
    <div className={cn('space-y-3', isScreenplay && 'font-mono text-[13px] leading-relaxed')}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <p key={i} className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {block.text}
              </p>
            );

          case 'direction':
            return (
              <p
                key={i}
                className={cn(
                  'italic text-slate-500 dark:text-slate-400',
                  isScreenplay ? 'pl-16' : 'border-l-2 border-slate-200 pl-3 dark:border-slate-700',
                )}
              >
                {block.text}
              </p>
            );

          case 'dialogue':
            return isScreenplay ? (
              <div key={i} className="space-y-0.5">
                <p className="pl-20 font-semibold uppercase">{block.speaker}</p>
                <p className="pl-12 pr-12">{block.text}</p>
              </div>
            ) : (
              <div key={i} className="rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">{block.speaker}</p>
                <p className="mt-0.5">{block.text}</p>
              </div>
            );

          case 'choice':
            return onChoice ? (
              <button
                key={i}
                type="button"
                onClick={() => onChoice(block.text)}
                className="flex w-full items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3.5 py-2.5 text-left text-sm font-medium transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-500/10 dark:hover:border-indigo-600"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                  {block.index}
                </span>
                {block.text}
              </button>
            ) : (
              <p key={i}>
                {block.index}) {block.text}
              </p>
            );

          default:
            // Narration keeps full markdown — a story can still contain a
            // list, emphasis or a link, and this is also the fail-open path
            // for a model that ignored the format entirely.
            return (
              <Markdown key={i} className="prose-sm">
                {block.text}
              </Markdown>
            );
        }
      })}
    </div>
  );
}
