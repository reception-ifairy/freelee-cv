import Link from 'next/link';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AttentionItem, AttentionLevel } from '@/lib/admin/attention';
import type { Tree } from '@/lib/taxonomy/browser';
import { cn } from '@/lib/utils';

const LEVEL: Record<AttentionLevel, { label: string; dot: string; tone: 'rose' | 'amber' | 'slate' }> = {
  act: { label: 'Act', dot: 'bg-rose-400', tone: 'rose' },
  check: { label: 'Check', dot: 'bg-amber-400', tone: 'amber' },
  tidy: { label: 'Tidy', dot: 'bg-slate-500', tone: 'slate' },
};

/** The dashboard's first panel: what needs doing, most urgent first, each row a link to where it is done. */
export function AttentionPanel({ items, className }: { items: AttentionItem[]; className?: string }) {
  return (
    <Card padding="md" className={className} id="attention">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Needs your attention</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {items.filter((i) => i.level === 'act').length} act · {items.filter((i) => i.level === 'check').length} check ·{' '}
          {items.filter((i) => i.level === 'tidy').length} tidy
        </p>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-emerald-300">
          <CircleCheck className="size-4" /> Nothing is waiting on you.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/5">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="group -mx-2 flex items-start gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-white/[0.03]">
                <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', LEVEL[item.level].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {item.title}
                    <Badge tone={LEVEL[item.level].tone}>{LEVEL[item.level].label}</Badge>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.detail}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The pillars at a glance: every category with its live/total bots, the
 * busiest first, each a link to the category in the taxonomy browser.
 * Categories with no bot are dimmed (2026-11-16: the categories are the
 * pillars; the computed markets this replaced are gone).
 */
export function CategoriesCard({ tree }: { tree: Tree }) {
  const rows = [...tree.categories].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return (
    <Card padding="md">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Categories</h2>
        <Link href="/admin/taxonomy" className="text-xs font-semibold text-brand-400 hover:underline">
          Taxonomy →
        </Link>
      </div>
      <p className="mt-1 font-mono text-[11px] text-slate-500">
        {tree.all.live}/{tree.all.total} bots live · {tree.categories.filter((c) => c.total === 0).length} categories without a bot
      </p>
      <ul className="mt-3 max-h-[26rem] space-y-0.5 overflow-y-auto pr-1">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/taxonomy?cat=${c.id}`}
              className={cn('-mx-2 flex items-center gap-2 rounded-control px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.03]', c.total === 0 && 'text-slate-500')}
            >
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', c.total === 0 && 'opacity-50')} style={{ backgroundColor: c.color ?? '#6366f1' }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[11px] text-slate-400" title={`${c.live} live of ${c.total} bots`}>
                {c.live}/{c.total}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
