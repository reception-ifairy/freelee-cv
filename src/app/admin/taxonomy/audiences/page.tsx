import type { Metadata } from 'next';
import { Users2 } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AUDIENCE_SEGMENTS, type AudienceSegmentConfig } from '@/lib/persona/audience-segments';
import { AUDIENCE_TYPES } from '@/lib/persona/prompt';

export const metadata: Metadata = { title: 'Audiences' };

/**
 * The 70 audience segments, finally readable.
 *
 * Until now the only place any of this appeared was a checkbox list on the
 * persona form, which renders the code and the name and nothing else — so
 * somebody ticking `B2C-CYP-07` saw the words "SEND Learners" and none of what
 * they imply: ages 3–18, needs accessibility and adaptive pacing, expects a
 * patient, gentle, clear, adaptive voice, high sensitivity to getting it wrong.
 * All of that was already written down.
 */

const SENSITIVITY_TONE: Record<string, 'slate' | 'amber' | 'rose'> = {
  low: 'slate',
  medium: 'slate',
  medium_high: 'amber',
  high: 'amber',
  very_high: 'rose',
  critical: 'rose',
};

/** `B2C-CYP-01` → `CYP`. The catalogue groups by these but never names them. */
const FAMILY_LABEL: Record<string, string> = {
  'B2C-CYP': 'Children and young people',
  'B2C-GK': 'Gatekeepers',
  'B2C-ADU': 'Adults',
  'B2C-INT': 'Interest groups',
  'B2B-SIZE': 'By organisation size',
  'B2B-SEC': 'By industry',
  'B2B-FUN': 'By function',
  'B2G-CEN': 'Central government',
  'B2G-LOC': 'Local government',
  'B2G-PUB': 'Public services',
};

function familyOf(code: string): string {
  return code.split('-').slice(0, 2).join('-');
}

export default function AudiencesPage() {
  const all = Object.values(AUDIENCE_SEGMENTS);
  const byType = (['B2C', 'B2B', 'B2G'] as const).map((type) => {
    const segments = all.filter((s) => s.audienceType === type);
    const families = new Map<string, AudienceSegmentConfig[]>();
    for (const segment of segments) {
      const family = familyOf(segment.code);
      families.set(family, [...(families.get(family) ?? []), segment]);
    }
    return { type, segments, families: [...families.entries()] };
  });

  return (
    <div>
      <PageHeader
        title="Audiences"
        description="Seventy groups of people the bots might serve — who they are, what they need, and how they want to be spoken to. Attach the relevant ones to a category and they become part of the brief a specialist is designed against."
      />

      {byType.map(({ type, segments, families }) => (
        <section key={type} className="mb-10">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-lg font-semibold">{AUDIENCE_TYPES[type].label}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {segments.length} · {AUDIENCE_TYPES[type].description}
            </span>
          </div>

          {families.map(([family, members]) => (
            <div key={family} className="mb-5">
              <p className="eyebrow mb-2">{FAMILY_LABEL[family] ?? family}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {members.map((segment) => (
                  <Card key={segment.code} padding="sm" className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{segment.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{segment.description}</p>
                      </div>
                      <Badge tone={SENSITIVITY_TONE[segment.riskSensitivity] ?? 'slate'}
                        title="How badly a wrong answer lands with this group.">
                        {segment.riskSensitivity.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                      {segment.ageRangeMin && segment.ageRangeMax ? (
                        <span>{segment.ageRangeMin}–{segment.ageRangeMax} years</span>
                      ) : null}
                      {segment.ukContext ? <span>{segment.ukContext}</span> : null}
                      {segment.ukMarketSize ? <span>{segment.ukMarketSize}</span> : null}
                    </p>

                    <div>
                      <p className="eyebrow mb-1">Needs</p>
                      <p className="text-xs">{segment.keyNeeds.map((n) => n.replace(/_/g, ' ')).join(' · ')}</p>
                    </div>

                    {segment.preferredTone?.length ? (
                      <div>
                        <p className="eyebrow mb-1">Speak to them</p>
                        <p className="text-xs">{segment.preferredTone.join(' · ')}</p>
                      </div>
                    ) : null}

                    {segment.decisionFactors?.length ? (
                      <div>
                        <p className="eyebrow mb-1">They decide on</p>
                        <p className="text-xs">{segment.decisionFactors.map((d) => d.replace(/_/g, ' ')).join(' · ')}</p>
                      </div>
                    ) : null}

                    <p className="mt-auto pt-1 font-mono text-[10px] text-slate-400">{segment.code}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Users2 className="size-4" />
        This catalogue lives in source, not the database — it came from the UK marketplace reference
        schema and is edited by changing <code className="font-mono">src/lib/persona/audience-segments.ts</code>.
      </p>
    </div>
  );
}
