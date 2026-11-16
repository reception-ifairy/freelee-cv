import { LayoutTemplate, ShieldCheck, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MeterGroup } from '@/components/ui/meter';
import type { CategoryBrief } from '@/lib/taxonomy/types';

const RISK_LABEL: Record<string, string> = {
  R0: 'R0 — ordinary commercial work',
  R1: 'R1 — some potential for harm',
  R2: 'R2 — regulated or safety-relevant',
  R3: 'R3 — high risk to life or livelihood',
};

/**
 * A category's Brief tab: the researched facts its bots are designed against
 * — the market, the field's lean towards consumers, businesses or government,
 * and what its slug decides. Moved out of the old /admin/taxonomy/[id]
 * workspace when the category became a view of the taxonomy browser
 * (2026-11-16).
 */
export function CategoryBriefTab({ brief }: { brief: CategoryBrief }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
