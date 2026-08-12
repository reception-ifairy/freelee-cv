'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GridSelectOption = {
  id: string;
  label: string;
  meta?: string;
};

/**
 * A dropdown whose open panel renders options as a grid instead of a native
 * `<select>`'s one-per-line list — for option sets that are longer or grow
 * over time (providers, and models once fetched live). No new dependency:
 * this codebase has no Radix/Headless UI, so this is a plain controlled
 * component (outside-click + Escape close it), same minimal-dependency
 * posture as everything else here.
 *
 * If `name` is passed, a hidden input carries the value so this drops into
 * an existing native `<form>`/server-action submission unchanged.
 */
export function GridSelect({
  id,
  name,
  options,
  value,
  onChange,
  columns = 4,
  placeholder = 'Select…',
}: {
  id?: string;
  name?: string;
  options: GridSelectOption[];
  value: string;
  onChange: (id: string) => void;
  columns?: 2 | 3 | 4;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns];

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
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
      >
        <span className={selected ? '' : 'text-slate-400'}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="animate-slide-up absolute z-30 mt-2 w-full min-w-72 rounded-card border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className={cn('grid gap-2', cols)}>
            {options.length === 0 ? (
              <p className="col-span-full py-2 text-center text-xs text-slate-400">No options.</p>
            ) : (
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-lg border p-2.5 text-left text-xs transition',
                    option.id === value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
                  )}
                >
                  <p className="truncate font-semibold">{option.label}</p>
                  {option.meta ? <p className="mt-0.5 truncate font-mono text-slate-500 dark:text-slate-400">{option.meta}</p> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
