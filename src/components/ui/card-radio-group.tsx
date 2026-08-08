'use client';

import { cn } from '@/lib/utils';

export type CardRadioItem = {
  id: string;
  label: string;
  hint?: string;
  /** Rendered as a small font-mono line under the hint — e.g. a model id or price. */
  meta?: string;
  style?: React.CSSProperties;
};

/**
 * Always-visible grid of selectable cards, for small fixed option sets (a
 * handful of choices) where a dropdown would hide information the user
 * benefits from seeing all at once — model tiers, icons, fonts. For longer
 * or dynamic lists (providers, models once live-fetched), use `GridSelect`
 * instead, which collapses into a dropdown.
 *
 * Extracted from the tier-picker markup that was previously hand-duplicated
 * in persona-form.tsx and ai-settings-form.tsx.
 */
export function CardRadioGroup({
  name,
  items,
  value,
  onChange,
  columns = 3,
}: {
  name: string;
  items: readonly CardRadioItem[];
  value: string;
  onChange: (id: string) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns];

  return (
    <div className={cn('grid gap-3', cols)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={item.style}
          className={cn(
            'rounded-xl border p-4 text-left transition',
            value === item.id
              ? 'glow-ring border-brand-500 bg-brand-50 dark:bg-brand-500/10'
              : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
          )}
        >
          <input
            type="radio"
            name={name}
            value={item.id}
            checked={value === item.id}
            onChange={() => onChange(item.id)}
            className="sr-only"
          />
          <p className="font-semibold">{item.label}</p>
          {item.hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p> : null}
          {item.meta ? <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{item.meta}</p> : null}
        </button>
      ))}
    </div>
  );
}
