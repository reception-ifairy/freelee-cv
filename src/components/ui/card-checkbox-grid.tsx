'use client';

import { cn } from '@/lib/utils';

export type CardCheckboxItem = {
  id: string;
  label: string;
  hint?: string;
  meta?: string;
  disabled?: boolean;
};

/**
 * Always-visible grid of multi-select cards — same visual language as
 * `CardRadioGroup` but checkboxes instead of radios. Used for review-and-pick
 * flows (e.g. "here's what we fetched live, choose which to import"), not as
 * a persistent compact form field — see `GridSelect` for that case.
 */
export function CardCheckboxGrid({
  name,
  items,
  values,
  onChange,
  columns = 3,
}: {
  name: string;
  items: CardCheckboxItem[];
  values: string[];
  onChange: (ids: string[]) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns];

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };

  return (
    <div className={cn('grid gap-3', cols)}>
      {items.map((item) => {
        const checked = values.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => toggle(item.id)}
            className={cn(
              'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
              checked
                ? 'glow-ring border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={item.id}
              checked={checked}
              disabled={item.disabled}
              onChange={() => toggle(item.id)}
              className="sr-only"
            />
            <p className="font-semibold">{item.label}</p>
            {item.hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p> : null}
            {item.meta ? <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{item.meta}</p> : null}
          </button>
        );
      })}
    </div>
  );
}
