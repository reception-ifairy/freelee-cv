import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, ShieldCheck, Wrench, LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeterGroup } from '@/components/ui/meter';
import { PersonaMark } from '@/components/site/persona-mark';
import { categoryBrief } from '@/lib/taxonomy/brief';
import { personaCountsBySector } from '@/lib/taxonomy/queries';
import { AudiencePicker } from './audience-picker';
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

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) notFound();

  const brief = await categoryBrief(categoryId);
  if (!brief) notFound();

  const counts = await personaCountsBySector(categoryId);

  return (
    <div>
      <Link
        href="/admin/taxonomy"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> Categories
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <PersonaMark
          personaKey={brief.slug}
          categoryKey={brief.slug}
          categoryIndex={brief.id}
          accent={brief.color ?? '#6366f1'}
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <PageHeader title={brief.name} description={brief.description ?? undefined} />
        </div>
        <Link
          href={`/admin/categories/${brief.id}`}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <Pencil className="size-4" /> Edit data
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Workbench categoryId={brief.id} categoryName={brief.name} sectors={brief.sectors} />

          <section>
            <h2 className="eyebrow mb-2">Specialisms</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {brief.sectors.map((sector) => (
                <Link
                  key={sector.id}
                  href={`/admin/sectors/${sector.id}`}
                  className="focus-ring rounded-card border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{sector.name}</p>
                    {counts.get(sector.id) ? <Badge tone="brand">{counts.get(sector.id)}</Badge> : null}
                  </div>
                  {sector.description ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sector.description}</p>
                  ) : null}
                  <div className="mt-2">
                    <MeterGroup
                      items={[
                        { label: 'B2C', value: sector.b2c },
                        { label: 'B2B', value: sector.b2b, tone: 'emerald' },
                        { label: 'B2G', value: sector.b2g, tone: 'amber' },
                      ]}
                    />
                  </div>
                  {sector.interactionModes.length ? (
                    <p className="mt-2 text-xs text-slate-400">{sector.interactionModes.join(' · ').toLowerCase()}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>

          <AudiencePicker
            categoryId={brief.id}
            selected={brief.audiences.map((a) => ({ code: a.code, note: a.note }))}
          />
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
