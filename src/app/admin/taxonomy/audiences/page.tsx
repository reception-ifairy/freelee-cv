import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Users2 } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { RouteSheet } from '@/components/ui/route-sheet';
import { AUDIENCE_SEGMENTS, type AudienceSegmentConfig } from '@/lib/persona/audience-segments';
import { AUDIENCE_TYPES } from '@/lib/persona/prompt';
import { segmentUsage } from '@/lib/taxonomy/segment-usage';

export const metadata: Metadata = { title: 'Audiences' };

/**
 * The 70 audience segments as a browser: families that fold, one compact row
 * per segment, and the full card in a sheet on demand (`?open=B2C-CYP-07`).
 *
 * It was 70 expanded cards in one column (owner, 2026-11-14: "a list where the
 * card opens when you want it"). The card now also says where the segment is
 * used — which categories link it and which personas list it, and how many of
 * those never pass it to the model because their own audience type differs.
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

const TYPES = ['B2C', 'B2B', 'B2G'] as const;

function familyOf(code: string): string {
  return code.split('-').slice(0, 2).join('-');
}

const words = (list: readonly string[] | undefined) => (list ?? []).map((w) => w.replace(/_/g, ' ')).join(' · ');
const ages = (s: AudienceSegmentConfig) => (s.ageRangeMin && s.ageRangeMax ? `${s.ageRangeMin}–${s.ageRangeMax}` : null);
const hrefFor = (code: string) => `/admin/taxonomy/audiences?open=${encodeURIComponent(code)}`;

function Sensitivity({ value }: { value: string }) {
  return (
    <Badge tone={SENSITIVITY_TONE[value] ?? 'slate'} title="How badly a wrong answer lands with this group.">
      {value.replace(/_/g, ' ')}
    </Badge>
  );
}

export default async function AudiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const openCode = typeof params.open === 'string' ? params.open : null;

  // Catalogue order: by type, then by family as the file declares them.
  const ordered = TYPES.flatMap((type) => Object.values(AUDIENCE_SEGMENTS).filter((s) => s.audienceType === type));
  const openAt = openCode ? ordered.findIndex((s) => s.code === openCode) : -1;
  const openSegment = openAt === -1 ? null : ordered[openAt];
  const usage = openSegment ? await segmentUsage(openSegment.code, openSegment.audienceType) : null;

  const byType = TYPES.map((type) => {
    const families = new Map<string, AudienceSegmentConfig[]>();
    for (const segment of ordered.filter((s) => s.audienceType === type)) {
      const family = familyOf(segment.code);
      families.set(family, [...(families.get(family) ?? []), segment]);
    }
    return { type, count: [...families.values()].flat().length, families: [...families.entries()] };
  });

  return (
    <div>
      <PageHeader
        title="Audiences"
        description="Seventy groups of people the bots might serve — who they are, what they need, and how they want to be spoken to. Attach the relevant ones to a category and they become part of the brief a specialist is designed against. Open a family, then a row for the whole card."
      />

      {byType.map(({ type, count, families }) => (
        <section key={type} className="mb-8">
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="text-lg font-semibold">{AUDIENCE_TYPES[type].label}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {count} · {AUDIENCE_TYPES[type].description}
            </span>
          </div>

          <div className="divide-y divide-slate-200 rounded-card border border-slate-200 bg-white px-2 dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.02]">
            {families.map(([family, members]) => (
              <Disclosure
                key={family}
                id={`family-${family}`}
                // Open the family behind an open card, so closing it lands on its row.
                defaultOpen={openSegment ? familyOf(openSegment.code) === family : false}
                title={
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="shrink-0">{FAMILY_LABEL[family] ?? family}</span>
                    <span className="truncate text-xs font-normal text-slate-500">{members.map((m) => m.name).join(', ')}</span>
                  </span>
                }
                meta={<span className="font-mono">{members.length}</span>}
              >
                <table className="mb-2 w-full text-sm">
                  <thead className="sr-only">
                    <tr>
                      <th>Segment</th>
                      <th>Ages</th>
                      <th>Sensitivity</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((segment) => {
                      const current = segment.code === openSegment?.code;
                      return (
                        <tr
                          key={segment.code}
                          className={`relative transition-colors duration-[--duration-fast] hover:bg-slate-50 dark:hover:bg-white/[0.04] ${current ? 'bg-brand-500/10' : ''}`}
                        >
                          <td className="py-2 pr-3 pl-8">
                            {/* The link stretches over the whole row (after:inset-0), so
                                the row is one target but stays one tab stop. */}
                            <Link
                              id={`row-${segment.code}`}
                              href={hrefFor(segment.code)}
                              scroll={false}
                              aria-current={current ? 'true' : undefined}
                              className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:ring-2 focus-visible:after:ring-brand-500"
                            >
                              {segment.name}
                            </Link>
                            <span className="ml-2 hidden text-xs text-slate-500 md:inline dark:text-slate-400">{segment.description}</span>
                          </td>
                          <td className="w-20 py-2 pr-3 text-xs whitespace-nowrap text-slate-400">{ages(segment) ? `${ages(segment)} yrs` : ''}</td>
                          <td className="w-28 py-2 pr-3"><Sensitivity value={segment.riskSensitivity} /></td>
                          <td className="w-28 py-2 pr-2 text-right font-mono text-[11px] text-slate-500">{segment.code}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Disclosure>
            ))}
          </div>
        </section>
      ))}

      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Users2 className="size-4" />
        This catalogue lives in source, not the database — it came from the UK marketplace reference
        schema and is edited by changing <code className="font-mono">src/lib/persona/audience-segments.ts</code>.
      </p>

      {openSegment && usage ? (
        <RouteSheet
          openId={openSegment.code}
          closeHref="/admin/taxonomy/audiences"
          returnFocusId={`row-${openSegment.code}`}
          eyebrow={`${AUDIENCE_TYPES[openSegment.audienceType].label} · ${FAMILY_LABEL[familyOf(openSegment.code)] ?? ''}`}
          title={openSegment.name}
          subtitle={openSegment.description}
          actions={
            <>
              <span className="mr-1 font-mono text-[11px] text-slate-500">{openAt + 1}/{ordered.length}</span>
              <StepLink code={ordered[openAt - 1]?.code} label="Previous segment" icon={<ChevronUp className="size-4" />} />
              <StepLink code={ordered[openAt + 1]?.code} label="Next segment" icon={<ChevronDown className="size-4" />} />
            </>
          }
        >
          <SegmentCard segment={openSegment} usage={usage} />
        </RouteSheet>
      ) : null}
    </div>
  );
}

function StepLink({ code, label, icon }: { code?: string; label: string; icon: React.ReactNode }) {
  const className = 'grid size-8 place-items-center rounded-lg text-slate-400 transition-colors';
  if (!code) return <span aria-hidden className={`${className} opacity-30`}>{icon}</span>;
  return (
    <Link href={hrefFor(code)} scroll={false} replace aria-label={label} title={label} className={`${className} hover:bg-white/5 hover:text-slate-200`}>
      {icon}
    </Link>
  );
}

function SegmentCard({ segment, usage }: { segment: AudienceSegmentConfig; usage: Awaited<ReturnType<typeof segmentUsage>> }) {
  const facts: [string, React.ReactNode][] = [
    ['Code', <span key="c" className="font-mono">{segment.code}</span>],
    ['Sensitivity', <Sensitivity key="s" value={segment.riskSensitivity} />],
    ['Ages', ages(segment) ? `${ages(segment)} years` : '—'],
    ['UK context', segment.ukContext ?? '—'],
    ['Market size', segment.ukMarketSize ?? '—'],
    ['Narrative fit', segment.narrativeFit ? segment.narrativeFit.replace(/_/g, ' ') : '—'],
  ];

  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-slate-500 dark:text-slate-400">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <Block title="Needs">{words(segment.keyNeeds)}</Block>
      {segment.preferredTone?.length ? <Block title="Speak to them">{words(segment.preferredTone)}</Block> : null}
      {segment.decisionFactors?.length ? <Block title="They decide on">{words(segment.decisionFactors)}</Block> : null}

      <Block title={`Linked by ${usage.categories.length} ${usage.categories.length === 1 ? 'category' : 'categories'}`}>
        {usage.categories.length ? (
          <ul className="space-y-1.5">
            {usage.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/taxonomy/${c.id}`} className="font-medium text-brand-400 hover:underline">{c.name}</Link>
                {c.note ? <span className="text-slate-500 dark:text-slate-400"> — {c.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-slate-500">No category links it, so no category brief mentions these people.</span>
        )}
      </Block>

      <Block title={`Listed by ${usage.totalPersonas} ${usage.totalPersonas === 1 ? 'persona' : 'personas'} (${usage.livePersonas} live)`}>
        {usage.storedOnly ? (
          <p className="mb-2 text-xs text-amber-500">
            {usage.storedOnly} of them {usage.storedOnly === 1 ? 'is' : 'are'} not {segment.audienceType}, so the segment is stored
            but never reaches {usage.storedOnly === 1 ? 'its' : 'their'} prompt (the prompt names only segments of the persona&apos;s own kind).
          </p>
        ) : null}
        {usage.personas.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {usage.personas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/personas/${p.id}`}
                  title={p.reachesPrompt ? undefined : 'Stored only — not in this persona’s prompt'}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-brand-500/60 ${
                    p.reachesPrompt ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-amber-500/40 text-slate-400'
                  }`}
                >
                  <span aria-hidden className={`size-1.5 rounded-full ${p.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className="sr-only">{p.isActive ? 'Live: ' : 'Inactive: '}</span>
                  {p.name}
                </Link>
              </li>
            ))}
            {usage.totalPersonas > usage.personas.length ? (
              <li className="px-1 text-xs text-slate-500">+{usage.totalPersonas - usage.personas.length} more</li>
            ) : null}
          </ul>
        ) : (
          <span className="text-slate-500">No persona lists it.</span>
        )}
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{title}</p>
      <div>{children}</div>
    </div>
  );
}
