import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { treeInputs } from '@/lib/taxonomy/browser-queries';
import { RISK_MEANING, RISK_TONE } from '@/lib/taxonomy/browser';
import { marketSummaries } from '@/lib/taxonomy/pillar-queries';
import { PILLAR_BY_ID, isPillarId } from '@/lib/taxonomy/pillars';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ pillar: string }> }): Promise<Metadata> {
  const { pillar } = await params;
  return { title: isPillarId(pillar) ? PILLAR_BY_ID[pillar].label : 'Market' };
}

const RISK_ORDER = ['R0', 'R1', 'R2', 'R3'];

/**
 * One market: the fields that serve it, its audience groups and where each is
 * used, and a way into its bots in the taxonomy browser (`?pillar=`).
 * Homeschooling gains its own tabs (tutors, curriculum, families) next.
 */
export default async function MarketPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: id } = await params;
  if (!isPillarId(id)) notFound();

  const [markets, inputs] = await Promise.all([marketSummaries(), treeInputs()]);
  const market = markets.find((m) => m.pillar.id === id)!;
  const { pillar } = market;
  const riskOf = new Map(inputs.categories.map((c) => [c.id, c.riskLevel]));
  const belowFloor = (risk: string | null | undefined) =>
    pillar.riskFloor !== null && RISK_ORDER.indexOf(risk ?? 'R0') < RISK_ORDER.indexOf(pillar.riskFloor);
  const under = market.categories.filter((c) => belowFloor(riskOf.get(c.id)));

  return (
    <div>
      <Link href="/admin/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" /> Markets
      </Link>

      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: pillar.color }} />
            {pillar.label}
            <Badge tone={pillar.status === 'live' ? 'green' : 'slate'}>{pillar.status === 'live' ? 'Sold now' : 'Planned'}</Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pillar.description}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-400">
            <span>{market.bots.live}/{market.bots.total} bots live</span>
            <span>{market.categories.length} {market.categories.length === 1 ? 'field' : 'fields'}</span>
            <span>{market.segments.filter((s) => s.linkedBy).length}/{market.segments.length} audience groups linked</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {market.offering ? (
            <Link href={`/${market.offering.slug}`} className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
              <ExternalLink className="size-3.5" /> /{market.offering.slug}
            </Link>
          ) : null}
          <Link href={`/admin/taxonomy?pillar=${pillar.id}`} className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700">
            <Layers className="size-3.5" /> Browse its bots
          </Link>
        </div>
      </header>

      {pillar.riskFloor ? (
        <p className={`mb-6 rounded-control border px-3 py-2 text-sm ${under.length ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-slate-200 text-slate-400 dark:border-white/10'}`}>
          Fields serving this market should carry at least <strong>{pillar.riskFloor}</strong> ({RISK_MEANING[pillar.riskFloor].split(' — ')[1]}).{' '}
          {under.length ? `${under.map((c) => c.name).join(', ')} ${under.length === 1 ? 'is' : 'are'} below it.` : 'Every field here meets it.'}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Fields serving it</h2>
        <p className="mb-3 text-xs text-slate-500">A field serves a market when it links one of the market’s audience groups or has a bot in it.</p>
        {market.categories.length ? (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <tr>
                  <TH className="px-3 py-2">Field</TH>
                  <TH className="px-3 py-2">Bots here</TH>
                  <TH className="px-3 py-2">Links its groups</TH>
                  <TH className="px-3 py-2">Risk</TH>
                </tr>
              </THead>
              <TBody>
                {market.categories.map((c) => {
                  const risk = riskOf.get(c.id) ?? null;
                  return (
                    <TR key={c.id}>
                      <TD className="px-3 py-2">
                        <Link href={`/admin/taxonomy?pillar=${pillar.id}&cat=${c.id}`} className="flex items-center gap-2 font-medium hover:text-brand-400">
                          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: c.color ?? '#6366f1' }} />
                          {c.name}
                        </Link>
                      </TD>
                      <TD className="px-3 py-2 font-mono text-xs">{c.bots.live}/{c.bots.total}</TD>
                      <TD className="px-3 py-2 text-xs">{c.linksSegments ? 'yes' : <span className="text-slate-500" title="Here only through its bots">no — through bots only</span>}</TD>
                      <TD className="px-3 py-2">
                        {risk ? <Badge tone={belowFloor(risk) ? 'amber' : RISK_TONE[risk] ?? 'slate'} title={RISK_MEANING[risk]}>{risk}{belowFloor(risk) ? ` < ${pillar.riskFloor}` : ''}</Badge> : '—'}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        ) : (
          <p className="text-sm text-slate-500">No field serves it yet. Link one of its audience groups to a category, on that category’s workspace.</p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Its audience groups</h2>
        <p className="mb-3 text-xs text-slate-500">Bots counted only where the group is of the bot’s own type — the ones that reach its prompt.</p>
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH className="px-3 py-2">Group</TH>
                <TH className="px-3 py-2">Code</TH>
                <TH className="px-3 py-2">Fields linking it</TH>
                <TH className="px-3 py-2">Bots listing it</TH>
              </tr>
            </THead>
            <TBody>
              {market.segments.map((s) => (
                <TR key={s.code}>
                  <TD className="px-3 py-2">
                    <Link href={`/admin/taxonomy/audiences?open=${s.code}`} className="font-medium hover:text-brand-400">{s.name}</Link>
                  </TD>
                  <TD className="px-3 py-2 font-mono text-[11px] text-slate-500">{s.code}</TD>
                  <TD className={`px-3 py-2 font-mono text-xs ${s.linkedBy ? '' : 'text-slate-600'}`}>{s.linkedBy}</TD>
                  <TD className={`px-3 py-2 font-mono text-xs ${s.listedBy ? '' : 'text-slate-600'}`}>{s.listedBy}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
