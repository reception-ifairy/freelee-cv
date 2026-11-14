import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MeterGroup } from '@/components/ui/meter';
import { AUDIENCE_SEGMENTS, isAudienceSegmentCode } from '@/lib/persona/audience-segments';
import { RISK_MEANING, RISK_TONE } from '@/lib/taxonomy/browser';
import type { personaCard, sectorCard } from '@/lib/taxonomy/browser-queries';

type PersonaCardData = NonNullable<Awaited<ReturnType<typeof personaCard>>>;
type SectorCardData = NonNullable<Awaited<ReturnType<typeof sectorCard>>>;

const date = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const words = (list: readonly string[] | null | undefined) => (list ?? []).map((w) => w.replace(/_/g, ' ')).join(' · ');

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-slate-500 dark:text-slate-400">{term}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** A bot at a glance: where it is filed, who it is for, what runs it, how much it is used. */
export function PersonaSheetBody({ card, sectorHref }: { card: PersonaCardData; sectorHref: string | null }) {
  const segments = (card.audienceSegments ?? []).filter(isAudienceSegmentCode).map((code) => AUDIENCE_SEGMENTS[code]);
  const scope = card.curriculumScope;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {card.isActive ? <Badge tone="green">Live</Badge> : <Badge tone="slate">Not live</Badge>}
        <Badge tone="slate">{card.visibility}</Badge>
        {scope ? <Badge tone="brand">Curriculum tutor</Badge> : null}
        {card.isFeatured ? <Badge tone="amber">Featured</Badge> : null}
        {card.isPremium ? <Badge tone="amber">Premium</Badge> : null}
      </div>

      <Facts
        rows={[
          ['Sector', sectorHref && card.sectorName ? <Link href={sectorHref} scroll={false} className="text-brand-400 hover:underline">{card.sectorName}</Link> : '—'],
          ['Audience', card.audienceType ?? '—'],
          ['Model', <span key="m" className="font-mono text-xs">{card.aiProvider ? `${card.aiProvider} · ${card.model ?? 'its default model'}` : 'platform default'}</span>],
          ['Version', card.version ?? '—'],
          ['Credits / message', card.creditsPerMessage],
          ['Chats · messages', <span key="u" className="font-mono text-xs">{card.chatsCount.toLocaleString('en-GB')} · {card.messagesCount.toLocaleString('en-GB')}</span>],
          ['Created · updated', `${date(card.createdAt)} · ${date(card.updatedAt)}`],
        ]}
      />

      {scope ? (
        <Block title="Curriculum scope">
          {[scope.keyStages.join(', '), scope.subjects.join(', '), scope.year ? `Year ${scope.year}` : null].filter(Boolean).join(' · ')}
        </Block>
      ) : null}

      {segments.length ? (
        <Block title={`Audience segments (${segments.length})`}>
          <ul className="flex flex-wrap gap-1.5">
            {segments.map((segment) => {
              const reaches = segment.audienceType === card.audienceType;
              return (
                <li key={segment.code}>
                  <Link
                    href={`/admin/taxonomy/audiences?open=${segment.code}`}
                    title={reaches ? segment.description : 'Stored only — another audience type, so it never reaches this bot’s prompt'}
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-brand-500/60 ${
                      reaches ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-amber-500/40 text-slate-500'
                    }`}
                  >
                    {segment.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Block>
      ) : null}

      {card.expertise ? <Block title="Expertise">{card.expertise}</Block> : null}
      {card.description ? (
        <Block title="Description">
          <p className="whitespace-pre-line text-slate-300">{card.description}</p>
        </Block>
      ) : null}
    </div>
  );
}

/** A sector: what it is, how risky, who it suits, and how many bots are filed there. */
export function SectorSheetBody({ card }: { card: SectorCardData }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {card.isActive ? null : <Badge tone="slate">Switched off</Badge>}
        {card.riskLevel ? <Badge tone={RISK_TONE[card.riskLevel] ?? 'slate'}>{RISK_MEANING[card.riskLevel] ?? card.riskLevel}</Badge> : null}
      </div>

      <Facts
        rows={[
          ['Bots', <span key="b" className="font-mono text-xs">{card.live} live of {card.total}</span>],
          ['Narrative fit', card.narrativeFit ? card.narrativeFit.replace(/_/g, ' ') : '—'],
          ['Interaction', words(card.interactionModes) || '—'],
          ['Code', <span key="c" className="font-mono text-xs">{card.code ?? '—'}</span>],
        ]}
      />

      <Block title="Suits">
        <MeterGroup
          items={[
            { label: 'B2C', value: card.b2c },
            { label: 'B2B', value: card.b2b, tone: 'emerald' },
            { label: 'B2G', value: card.b2g, tone: 'amber' },
          ]}
        />
      </Block>

      {card.description ? (
        <Block title="Description">
          <p className="whitespace-pre-line text-slate-300">{card.description}</p>
        </Block>
      ) : null}
    </div>
  );
}
