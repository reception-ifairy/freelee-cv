import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, ShieldCheck, Wrench, LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { TabNav } from '@/components/admin/tab-nav';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeterGroup } from '@/components/ui/meter';
import { PersonaMark } from '@/components/site/persona-mark';
import { categoryBrief } from '@/lib/taxonomy/brief';
import { buildTree, RISK_MEANING, RISK_TONE } from '@/lib/taxonomy/browser';
import { treeCounts, treeInputs } from '@/lib/taxonomy/browser-queries';
import { botPillars, categoryPillars, categorySegments } from '@/lib/taxonomy/pillar-queries';
import { PILLAR_BY_ID } from '@/lib/taxonomy/pillars';
import { AudiencesTab } from './audiences-tab';
import { Workbench } from './workbench';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const brief = await categoryBrief(Number(id));
  return { title: brief?.name ?? 'Category' };
}

const RISK_LABEL: Record<string, string> = {
  R0: 'R0 — ordinary commercial work',
  R1: 'R1 — some potential for harm',
  R2: 'R2 — regulated or safety-relevant',
  R3: 'R3 — high risk to life or livelihood',
};

type Tab = 'overview' | 'audiences' | 'ai';

/**
 * A field's workspace: Overview, Audiences, AI (`?tab=`).
 *
 * It was one long page — workbench, sector tiles, audience picker and three
 * fact cards stacked — and the owner found the admin turning into a maze
 * (2026-11-14). The plan had Sectors and Bots tabs too; they are not here on
 * purpose. The taxonomy browser already lists a field's sectors and bots with
 * a card on demand, and a second copy is how a maze starts — so Overview
 * shows them in brief and links into the browser at this field.
 *
 * The AI tab holds the design workbench today; the field's AI steward (a
 * later plan) moves in there.
 */
export default async function CategoryWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) notFound();
  const tab: Tab = rawTab === 'audiences' || rawTab === 'ai' ? rawTab : 'overview';

  const [brief, inputs, counts, bySegments] = await Promise.all([categoryBrief(categoryId), treeInputs(), treeCounts(), categorySegments()]);
  if (!brief) notFound();

  const node = buildTree(inputs.categories, inputs.sectors, counts).categories.find((c) => c.id === categoryId);
  const bots = await botPillars(bySegments);
  const mine = bots.filter((b) => b.categoryId === categoryId);
  const markets = categoryPillars(bots, bySegments, [categoryId]).get(categoryId) ?? [];
  const base = `/admin/taxonomy/${brief.id}`;
  const browse = `/admin/taxonomy?cat=${brief.id}`;

  return (
    <div>
      <Link href={browse} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" /> Taxonomy
      </Link>

      <div className="mb-4 flex items-start gap-4">
        <PersonaMark
          personaKey={brief.slug}
          categoryKey={brief.slug}
          categoryIndex={brief.id}
          accent={brief.color ?? '#6366f1'}
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <PageHeader title={brief.name} description={brief.description ?? undefined} />
          <p className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{node?.live ?? 0}/{node?.total ?? 0} bots live</span>
            {brief.riskLevel ? <Badge tone={RISK_TONE[brief.riskLevel] ?? 'slate'} title={RISK_MEANING[brief.riskLevel]}>{brief.riskLevel}</Badge> : null}
            {markets.map((m) => (
              <Link key={m} href={`/admin/markets/${m}`} className="inline-flex items-center gap-1 hover:text-slate-200">
                <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: PILLAR_BY_ID[m].color }} />
                {PILLAR_BY_ID[m].label}
              </Link>
            ))}
          </p>
        </div>
        <Link
          href={`/admin/categories/${brief.id}`}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <Pencil className="size-4" /> Edit data
        </Link>
      </div>

      <TabNav
        label="Field workspace"
        active={tab}
        tabs={[
          { id: 'overview', label: 'Overview', href: base },
          { id: 'audiences', label: 'Audiences', href: `${base}?tab=audiences`, count: brief.audiences.length },
          { id: 'ai', label: 'AI workbench', href: `${base}?tab=ai` },
        ]}
      />

      {tab === 'audiences' ? (
        <AudiencesTab categoryId={brief.id} linked={brief.audiences.map((a) => ({ code: a.code, note: a.note }))} />
      ) : tab === 'ai' ? (
        <div className="max-w-4xl">
          <Workbench categoryId={brief.id} categoryName={brief.name} sectors={brief.sectors} />
        </div>
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="eyebrow">Bots</h2>
              <Link href={browse} className="text-xs font-semibold text-brand-400 hover:underline">Browse them →</Link>
            </div>
            <Card padding="md">
              <p className="text-sm">
                <span className="font-mono text-lg font-semibold">{node?.live ?? 0}</span>
                <span className="text-slate-500"> live of {node?.total ?? 0}</span>
              </p>
              {mine.length ? (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {markets
                    .map((m) => ({ m, here: mine.filter((b) => b.pillar === m) }))
                    .filter((x) => x.here.length)
                    .map(({ m, here }) => (
                      <li key={m} className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: PILLAR_BY_ID[m].color }} />
                        {PILLAR_BY_ID[m].label} <span className="font-mono">{here.filter((b) => b.isActive).length}/{here.length}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">None yet — design one in the AI workbench.</p>
              )}
            </Card>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="eyebrow">Specialisms · {brief.sectors.length}</h2>
              <Link href={`${browse}&tab=sectors`} className="text-xs font-semibold text-brand-400 hover:underline">Browse sectors →</Link>
            </div>
            <ul className="divide-y divide-slate-200 rounded-card border border-slate-200 dark:divide-white/5 dark:border-white/10">
              {(node?.sectors ?? []).map((sector) => (
                <li key={sector.id}>
                  <Link
                    href={`${browse}&sec=${sector.id}`}
                    className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-white/[0.03]"
                  >
                    <span className={`min-w-0 flex-1 truncate ${sector.isActive ? '' : 'text-slate-500'}`}>{sector.name}</span>
                    {sector.riskLevel && sector.riskLevel !== 'R0' ? (
                      <span className="font-mono text-[11px] text-amber-400/80" title={RISK_MEANING[sector.riskLevel]}>{sector.riskLevel}</span>
                    ) : null}
                    <span className={`font-mono text-xs ${sector.live ? 'text-slate-300' : 'text-slate-600'}`} title={`${sector.live} live of ${sector.total}`}>
                      {sector.live}/{sector.total}
                    </span>
                  </Link>
                </li>
              ))}
              {node?.unfiled.total ? (
                <li className="px-3 py-2 text-xs text-slate-500">{node.unfiled.total} bot{node.unfiled.total === 1 ? '' : 's'} here without a sector</li>
              ) : null}
            </ul>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="eyebrow">Who it serves · {brief.audiences.length}</h2>
              <Link href={`${base}?tab=audiences`} className="text-xs font-semibold text-brand-400 hover:underline">Audiences and notes →</Link>
            </div>
            {brief.audiences.length ? (
              <p className="text-sm text-slate-400">{brief.audiences.map((a) => a.name).join(' · ')}</p>
            ) : (
              <p className="text-sm text-slate-500">No audience yet — a bot designed here is designed for everyone.</p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-4">
          <Card padding="md">
            <p className="eyebrow mb-3">The market</p>
            <dl className="grid gap-2 text-sm">
              <Row label="Size (UK)" value={brief.market.size ?? '—'} />
              <Row label="Growth" value={brief.market.growth ?? '—'} />
              <Row label="Risk" value={brief.riskLevel ? RISK_LABEL[brief.riskLevel] : '—'} />
              <Row label="Narrative fit" value={brief.narrativePotential ?? '—'} />
            </dl>
            {brief.market.regulations.length ? (
              <div className="mt-3">
                <p className="eyebrow mb-1">Regulation</p>
                <p className="text-xs">{brief.market.regulations.map((r) => r.replace(/_/g, ' ')).join(' · ')}</p>
              </div>
            ) : null}
            {brief.market.industryBodies.length ? (
              <div className="mt-3">
                <p className="eyebrow mb-1">Industry bodies</p>
                <p className="text-xs">{brief.market.industryBodies.map((b) => b.replace(/_/g, ' ')).join(' · ')}</p>
              </div>
            ) : null}
          </Card>

          <Card padding="md">
            <p className="eyebrow mb-3">What this field leans towards</p>
            <MeterGroup
              items={[
                { label: 'B2C', value: brief.audienceLean.b2c },
                { label: 'B2B', value: brief.audienceLean.b2b, tone: 'emerald' },
                { label: 'B2G', value: brief.audienceLean.b2g, tone: 'amber' },
              ]}
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Averaged across its {brief.sectors.length} specialisms.
            </p>
          </Card>

          <Card padding="md">
            <p className="eyebrow mb-3">What the slug decides</p>
            <p className="mb-3 font-mono text-xs text-slate-400">/{brief.slug}</p>
            <ul className="grid gap-2 text-sm">
              <li className="flex items-start gap-2">
                <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>Chat layout: <strong>{brief.layout.label}</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Wrench className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>
                  Suggested tools:{' '}
                  {brief.suggestedTools.length
                    ? brief.suggestedTools.map((t) => t.label).join(', ')
                    : 'none'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>{brief.guardrails.length} safeguards apply at this risk level</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              The address is a contract, not a label — these behaviours key off it, so it never changes
              when the category is renamed.
            </p>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}
