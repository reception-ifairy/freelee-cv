'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search, X } from 'lucide-react';
import type { ListConfig, ListParams } from '@/lib/admin/list-query';
import { RISK_MEANING, selectionHref, type Count, type Selection, type Tree } from '@/lib/taxonomy/browser';
import { PILLAR_BY_ID, type PillarId } from '@/lib/taxonomy/pillars';
import { cn } from '@/lib/utils';

/**
 * The left half of the taxonomy browser: All › category › sector, each with
 * its live/total persona count. Every node is a plain link (`?cat=…&sec=…`),
 * so the server does the filtering, Back works and a node can be bookmarked;
 * only the filter box and which categories are unfolded live here.
 *
 * Search and filters on the right survive a click in the tree — search
 * "maths" and click through categories to see where the maths bots are.
 */
export function TaxonomyTree({
  tree,
  selection,
  params,
  config,
  pillarsByCategory = {},
}: {
  tree: Tree;
  selection: Selection;
  params: ListParams;
  config: ListConfig;
  /** The markets each category serves — a dot per market beside its name. */
  pillarsByCategory?: Record<number, PillarId[]>;
}) {
  const selectedCat = typeof selection.cat === 'number' ? selection.cat : null;
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(selectedCat !== null ? [selectedCat] : []));
  // Arriving at a category by any route (a header link, Back) unfolds it; it
  // never folds one the reader opened.
  const [seenCat, setSeenCat] = useState(selectedCat);
  if (selectedCat !== seenCat) {
    setSeenCat(selectedCat);
    if (selectedCat !== null && !expanded.has(selectedCat)) setExpanded(new Set([...expanded, selectedCat]));
  }

  const href = (next: Partial<Selection>) => selectionHref(params, config, selection, next);
  const term = filter.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(term);

  const visible = tree.categories.flatMap((category) => {
    if (!term) return [{ category, sectors: category.sectors, forced: false }];
    const ownMatch = matches(category.name);
    const sectors = category.sectors.filter((s) => matches(s.name));
    if (!ownMatch && sectors.length === 0) return [];
    // A category matching by name shows all its sectors; one matching through
    // its sectors shows only those, unfolded.
    return [{ category, sectors: ownMatch ? category.sectors : sectors, forced: !ownMatch }];
  });

  function toggle(id: number) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <nav aria-label="Taxonomy" className="text-sm">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Find a category or sector…"
          aria-label="Find a category or sector"
          className="h-8 w-full rounded-control border border-slate-200 bg-white pr-7 pl-8 text-xs focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none dark:border-white/10 dark:bg-white/[0.03]"
        />
        {filter ? (
          <button
            type="button"
            onClick={() => setFilter('')}
            aria-label="Clear"
            className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-slate-500 hover:text-slate-200"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <ul className="space-y-px">
        <li>
          <Node href={href({ cat: null })} current={selection.cat === null} label="All categories" count={tree.all} strong />
        </li>

        {visible.map(({ category, sectors, forced }) => {
          const open = forced || expanded.has(category.id);
          const listId = `tree-sectors-${category.id}`;
          return (
            <li key={category.id}>
              <div className="flex items-center">
                {category.sectors.length ? (
                  <button
                    type="button"
                    onClick={() => toggle(category.id)}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-label={`${open ? 'Hide' : 'Show'} sectors of ${category.name}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-slate-500 hover:bg-white/5 hover:text-slate-200"
                  >
                    <ChevronRight className={cn('size-3.5 transition-transform duration-[--duration-fast]', open && 'rotate-90')} />
                  </button>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
                <Node
                  href={href({ cat: category.id })}
                  current={selection.cat === category.id && selection.sec === null}
                  label={category.name}
                  count={category}
                  dot={category.color ?? '#6366f1'}
                  risk={category.riskLevel}
                  pillars={selection.pillar ? undefined : pillarsByCategory[category.id]}
                  muted={!category.isActive}
                  title={category.isActive ? undefined : 'Hidden from the site'}
                />
              </div>

              {open && sectors.length ? (
                <ul id={listId} className="ml-6 border-l border-slate-200 pl-1.5 dark:border-white/10">
                  {sectors.map((sector) => (
                    <li key={sector.id}>
                      <Node
                        href={href({ sec: sector.id })}
                        current={selection.sec === sector.id}
                        label={sector.name}
                        count={sector}
                        muted={!sector.isActive}
                        title={sector.isActive ? undefined : 'Switched off'}
                      />
                    </li>
                  ))}
                  {!term && category.unfiled.total ? (
                    <li className="px-2 py-1 text-[11px] text-slate-500" title="In this category but not filed under any sector">
                      {category.unfiled.total} without a sector
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}

        {tree.uncategorised.total && !term ? (
          <li className="mt-1 border-t border-slate-200 pt-1 dark:border-white/10">
            <Node href={href({ cat: 'none' })} current={selection.cat === 'none'} label="No category" count={tree.uncategorised} muted />
          </li>
        ) : null}

        {term && visible.length === 0 ? <li className="px-2 py-2 text-xs text-slate-500">Nothing matches “{filter.trim()}”.</li> : null}
      </ul>
    </nav>
  );
}

function Node({
  href,
  current,
  label,
  count,
  dot,
  risk,
  muted,
  strong,
  title,
  pillars,
}: {
  href: string;
  current: boolean;
  label: string;
  count: Count;
  dot?: string;
  risk?: string | null;
  pillars?: PillarId[];
  muted?: boolean;
  strong?: boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={current ? 'page' : undefined}
      title={title ? `${label} — ${title}` : label}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 rounded-control px-2 py-1 transition-colors duration-[--duration-fast]',
        current ? 'bg-brand-500/15 text-white' : 'hover:bg-white/[0.04]',
        muted && !current && 'text-slate-500',
        strong && 'font-semibold',
      )}
    >
      {dot ? <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {pillars?.length ? (
        <span className="flex shrink-0 gap-0.5" title={`Serves: ${pillars.map((id) => PILLAR_BY_ID[id].label).join(', ')}`}>
          {pillars.map((id) => (
            <span key={id} aria-hidden className="size-1 rounded-full" style={{ backgroundColor: PILLAR_BY_ID[id].color }} />
          ))}
        </span>
      ) : null}
      {risk && risk !== 'R0' ? (
        <span title={RISK_MEANING[risk]} className="shrink-0 font-mono text-[10px] text-amber-400/80">
          {risk}
        </span>
      ) : null}
      <span
        className={cn('shrink-0 font-mono text-[11px]', count.live ? 'text-slate-300' : 'text-slate-600')}
        title={`${count.live} live of ${count.total}`}
      >
        {count.live}/{count.total}
      </span>
    </Link>
  );
}
