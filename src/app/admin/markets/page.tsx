import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { marketSummaries } from '@/lib/taxonomy/pillar-queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Markets' };

/**
 * The six markets (src/lib/taxonomy/pillars.ts) side by side: how far each
 * is covered — bots, the fields that serve it, its audience groups, its
 * public page. Coverage, not revenue: there is almost no revenue to show
 * yet, and a market's readiness is what the owner steers by now.
 */
export default async function MarketsPage() {
  const markets = await marketSummaries();
  const allBots = markets.reduce((n, m) => n + m.bots.total, 0);

  return (
    <div>
      <PageHeader
        title="Markets"
        description="The six markets Freelee is built for, worked out from who each bot serves — nothing to assign by hand. Live markets are sold now; planned ones are designed for. This page shows coverage, not revenue."
      />

      {/* Where the bots are: one bar, a segment per market. */}
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5" role="img" aria-label="Share of bots per market">
        {markets.map((m) =>
          m.bots.total ? (
            <span key={m.pillar.id} style={{ width: `${(m.bots.total / allBots) * 100}%`, backgroundColor: m.pillar.color }} title={`${m.pillar.label}: ${m.bots.total} bots`} />
          ) : null,
        )}
      </div>
      <p className="mb-6 font-mono text-[11px] text-slate-500">{allBots} bots across the markets — each bot is in exactly one.</p>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-card border border-slate-200 dark:divide-white/5 dark:border-white/10">
        {markets.map((m) => {
          const linked = m.segments.filter((s) => s.linkedBy > 0).length;
          return (
            <li key={m.pillar.id}>
              <Link
                href={`/admin/markets/${m.pillar.id}`}
                className="group flex items-start gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              >
                <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: m.pillar.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.pillar.label}</span>
                    <Badge tone={m.pillar.status === 'live' ? 'green' : 'slate'}>{m.pillar.status === 'live' ? 'Sold now' : 'Planned'}</Badge>
                    {m.pillar.riskFloor ? <Badge tone="amber" title="The lowest risk level a field serving this market should carry">≥ {m.pillar.riskFloor}</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{m.pillar.description}</span>
                  <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                    <span>{m.bots.live}/{m.bots.total} bots live</span>
                    <span>{m.categories.length} {m.categories.length === 1 ? 'field' : 'fields'}</span>
                    <span>{linked}/{m.segments.length} audience groups linked</span>
                    <span>
                      page{' '}
                      {m.offering ? `/${m.offering.slug}${m.offering.published ? '' : ' (draft)'}` : m.pillar.offeringSlug ? `/${m.pillar.offeringSlug} missing` : '—'}
                    </span>
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
