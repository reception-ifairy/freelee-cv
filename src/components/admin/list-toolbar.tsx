'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { GridSelect } from '@/components/ui/grid-select';
import { HelpTip } from '@/components/ui/help-tip';
import {
  listHref, hasActiveFilters, PAGE_SIZES,
  type ListConfig, type ListParams,
} from '@/lib/admin/list-query';
import { cn } from '@/lib/utils';

/**
 * Search box, filter dropdowns, sort and page size — all of which write to the
 * URL rather than to component state, so the server can do the actual
 * filtering in SQL.
 *
 * Every control resets to page 1. Staying on page 7 while narrowing 300 results
 * down to 12 shows an empty list, which reads as "no results" when it really
 * means "no page 7".
 */
export function ListToolbar({
  params,
  config,
  total,
}: {
  params: ListParams;
  config: ListConfig;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState(params.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typed = useRef(false);

  function go(overrides: Parameters<typeof listHref>[3]) {
    // Any change resets to page 1 unless the caller is explicitly paging.
    const next = { page: 1, ...overrides };
    startTransition(() => router.replace(listHref(pathname, params, config, next), { scroll: false }));
  }

  // Debounced so a five-letter word is one request, not five. `replace` rather
  // than `push` keeps the back button meaningful — otherwise every keystroke
  // becomes a history entry to walk back through.
  useEffect(() => {
    if (!typed.current) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => go({ q: query }), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is recreated every render; depending on it would fire on every keystroke twice
  }, [query]);

  // The URL is the source of truth: a Clear-all or a back-navigation must be
  // reflected in the box, not overwritten by stale local state.
  useEffect(() => {
    typed.current = false;
    setQuery(params.q);
  }, [params.q]);

  const active = hasActiveFilters(params);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              typed.current = true;
              setQuery(event.target.value);
            }}
            placeholder="Search by name, tagline or expertise…"
            aria-label="Search"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
          />
          {pending ? (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                typed.current = true;
                setQuery('');
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {config.filters.map((filter) => (
          <div key={filter.key} className="min-w-40">
            <GridSelect
              options={[{ id: '', label: `All ${filter.label.toLowerCase()}` }, ...filter.options]}
              value={params.filters[filter.key] ?? ''}
              onChange={(value) => go({ filters: { [filter.key]: value } })}
              placeholder={filter.label}
              columns={2}
            />
          </div>
        ))}

        <div className="min-w-40">
          <GridSelect
            options={config.sorts}
            value={params.sort}
            onChange={(value) => go({ sort: value })}
            columns={2}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          <strong className="text-slate-700 dark:text-slate-200">{total.toLocaleString('en-GB')}</strong>{' '}
          {total === 1 ? 'result' : 'results'}
        </span>

        {active ? (
          <>
            {params.q ? <Chip label={`“${params.q}”`} onClear={() => go({ q: '' })} /> : null}
            {config.filters.map((filter) => {
              const value = params.filters[filter.key];
              if (!value) return null;
              const option = filter.options.find((o) => o.id === value);
              return (
                <Chip
                  key={filter.key}
                  label={`${filter.label}: ${option?.label ?? value}`}
                  onClear={() => go({ filters: { [filter.key]: '' } })}
                />
              );
            })}
            <button
              type="button"
              onClick={() => go({ q: '', filters: Object.fromEntries(config.filters.map((f) => [f.key, ''])) })}
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Clear all
            </button>
          </>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1">
            Per page
            <HelpTip
              title="Per page"
              body="How many cards to load at once. Bigger pages mean less clicking and a heavier page — 24 is a good balance on most screens."
            />
          </span>
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => go({ perPage: size })}
              aria-pressed={params.perPage === size}
              className={cn(
                'rounded-md px-1.5 py-0.5 font-medium transition',
                params.perPage === size
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              {size}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <X className="size-3" />
      </button>
    </span>
  );
}
