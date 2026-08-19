'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Coins, GripVertical, RotateCw, Shield, Sparkles, Wrench } from 'lucide-react';
import { PersonaMark } from './persona-mark';
import { Badge } from '@/components/ui/badge';
import { formatCredits } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * What an AI specialist looks like on this platform.
 *
 * **Never a human face.** Not a stock photo, not a generated portrait, not an
 * illustrated mascot — an AI specialist is not a person, and dressing one up as
 * one makes a promise the product cannot keep. The identity is a generated
 * mark (see `lib/persona/mark.ts`), and this card is deliberately incapable of
 * rendering an uploaded image: there is no `<img>` in it and it never reads
 * `personas.avatar`.
 *
 * The card reads as a **credential** rather than a profile. Front: who this
 * specialist is and what field it works in. Back: what it knows, what it can
 * do, and how to reach it.
 *
 * Three things it has to get right:
 *
 *  - **No stretched link.** The old card made the whole surface one anchor with
 *    `after:absolute after:inset-0`, which would swallow both the flip button
 *    and the drag handle. The link belongs on the title.
 *  - **Flip on click, not hover.** Hover-to-flip is unusable on touch and fires
 *    constantly while scanning a grid.
 *  - **The hidden face is inert**, so it never takes focus or gets read out
 *    while facing away.
 *
 * Two layout constraints that are easy to get wrong and were: the scene needs
 * `min-w-0`, because a grid item defaults to `min-width: auto` and one long
 * category name widened its whole column; and the faces need an explicit
 * `grid-cols-1` (`minmax(0, 1fr)`), because an implicit `auto` column grows to
 * the widest item — the back face, which is longer than the front.
 */

export type PersonaCardData = {
  slug: string;
  name: string;
  tagline: string | null;
  expertise: string | null;
  accentColor: string;
  isPremium: boolean;
  audienceType: string | null;
  messagesCount: number;
  creditsPerMessage: number;
  /** Taxonomy — the card's second and third axes. */
  categoryName: string | null;
  categorySlug: string | null;
  categoryColor: string | null;
  categoryId: number | null;
  sectorName: string | null;
  sectorSlug: string | null;
  /** From the persona's current version. Empty arrays are normal, not an error. */
  knowledgeDomains: string[];
  tools: string[];
  capabilities: Record<string, boolean | undefined>;
  guardrailCount: number;
  modelTier: string | null;
};

const CAPABILITY_LABELS: Record<string, string> = {
  vision: 'Reads images',
  images: 'Makes images',
  voiceIn: 'Listens',
  voiceOut: 'Speaks',
};

export function PersonaCard({
  persona,
  dragHandle,
  className,
}: {
  persona: PersonaCardData;
  /** Rendered in the corner where the card can be assigned by dragging. Omitted everywhere else. */
  dragHandle?: React.ReactNode;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const id = useId();

  // The category's colour where there is one, so specialists in a field look
  // like they work in the same field. The persona's own accent is the fallback.
  const accent = persona.categoryColor ?? persona.accentColor;
  const capabilities = Object.entries(CAPABILITY_LABELS).filter(([key]) => persona.capabilities[key]);

  return (
    <div className={cn('flip-scene h-full min-w-0', className)} data-flipped={flipped}>
      {/* `grid-cols-1`, not a bare `grid`. An implicit grid column is `auto`-sized,
          so it grows to the widest item — and the back face, with its domains
          and capabilities, is wider than the front. That made the card silently
          600px inside a 289px column and pushed the page's scroll width past
          the viewport. Tailwind's `grid-cols-1` is `minmax(0, 1fr)`, which is
          the part that refuses to expand. */}
      <div id={id} className="flip-inner grid h-full grid-cols-1">
        {/* Both faces occupy the same grid cell, so the taller one sets the
            height and the card never changes size when it turns. */}
        <Face side="front" flipped={flipped}>
          <div className="flex items-start gap-3">
            <PersonaMark
              personaKey={persona.slug}
              categoryKey={persona.categorySlug}
              sectorKey={persona.sectorSlug}
              categoryIndex={persona.categoryId}
              accent={accent}
              className="size-14"
            />
            <div className="min-w-0 flex-1">
              {persona.categoryName ? (
                // Reserves the flip button's corner. Without the padding the
                // taxonomy line runs underneath it and truncates mid-word.
                <p className="eyebrow truncate pr-8">
                  {persona.categoryName}
                  {persona.sectorName ? ` · ${persona.sectorName}` : ''}
                </p>
              ) : null}
              <h3 className="mt-1 text-base font-semibold leading-tight">
                <Link href={`/personas/${persona.slug}`} className="focus-ring rounded transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  {persona.name}
                </Link>
              </h3>
              {persona.expertise ? (
                <p className="mt-0.5 truncate text-xs font-medium text-brand-600 dark:text-brand-400">{persona.expertise}</p>
              ) : null}
            </div>
            {dragHandle}
          </div>

          {persona.tagline ? (
            <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{persona.tagline}</p>
          ) : null}

          <div className="mt-auto pt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {persona.audienceType ? <Badge tone="slate">{persona.audienceType}</Badge> : null}
              {persona.modelTier ? <Badge tone="slate">{persona.modelTier}</Badge> : null}
              {persona.isPremium ? <Badge tone="amber">Premium</Badge> : null}
            </div>

            {persona.tools.length > 0 ? (
              <p className="mt-2.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
                <Wrench className="size-3 shrink-0" />
                {/* What it can actually call, not what it might mention. */}
                {persona.tools.slice(0, 3).map((t) => t.replace(/_/g, ' ')).join(' · ')}
              </p>
            ) : null}
          </div>

          <FlipButton id={id} flipped={flipped} onClick={() => setFlipped(true)} label={`What ${persona.name} can do`} />
        </Face>

        <Face side="back" flipped={flipped}>
          <p className="eyebrow pr-8">What it brings</p>

          {persona.knowledgeDomains.length > 0 ? (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Sparkles className="size-3.5" /> Knows about
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {persona.knowledgeDomains.slice(0, 6).map((domain) => (
                  <span key={domain} className="rounded-lg border hairline px-1.5 py-0.5 text-[11px]">{domain}</span>
                ))}
              </div>
            </div>
          ) : null}

          {capabilities.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Can also</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {capabilities.map(([key, label]) => (
                  <span key={key} className="rounded-lg bg-brand-500/10 px-1.5 py-0.5 text-[11px] text-brand-600 dark:text-brand-400">{label}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-auto space-y-2 pt-4">
            {persona.guardrailCount > 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="size-3.5 shrink-0 text-emerald-500" />
                {persona.guardrailCount} safeguard{persona.guardrailCount === 1 ? '' : 's'} active
              </p>
            ) : null}
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Coins className="size-3.5 shrink-0" />
              {persona.creditsPerMessage > 0
                ? `${formatCredits(persona.creditsPerMessage)} credits a message`
                : 'Standard message rate'}
            </p>

            <Link
              href={`/personas/${persona.slug}`}
              className="focus-ring group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-brand-600 text-xs font-semibold text-on-brand transition hover:bg-brand-700"
            >
              {/* Not `name.split(' ')[0]` — a first word is not a first name,
                  and "Work with ZZ" is what that produces. */}
              Start a conversation
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <FlipButton id={id} flipped={flipped} onClick={() => setFlipped(false)} label="Back to the summary" back />
        </Face>
      </div>
    </div>
  );
}

/**
 * One face of the card.
 *
 * Builds its own surface rather than nesting a `Card`: the shared surface uses
 * `backdrop-blur` in dark mode, and a backdrop-filter inside a `preserve-3d`
 * container renders unpredictably across browsers.
 */
function Face({ side, flipped, children }: { side: 'front' | 'back'; flipped: boolean; children: React.ReactNode }) {
  const hidden = side === 'front' ? flipped : !flipped;

  return (
    <div
      // `inert` keeps the face that is turned away out of the tab order and
      // away from screen readers. Without it a grid of cards doubles the number
      // of stops, half of them invisible.
      inert={hidden ? true : undefined}
      aria-hidden={hidden}
      className={cn(
        'flip-face col-start-1 row-start-1 flex min-w-0 flex-col rounded-card border p-4',
        'border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0d10]',
        side === 'back' && 'flip-back',
      )}
    >
      {children}
    </div>
  );
}

function FlipButton({
  id, flipped, onClick, label, back,
}: { id: string; flipped: boolean; onClick: () => void; label: string; back?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={flipped}
      aria-controls={id}
      title={label}
      className="focus-ring absolute right-3 top-3 grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      {/* `aria-controls` names the element that actually changes — the turning
          container. It pointed at an id that was generated and then never
          attached to anything, which is worse than omitting it: a screen reader
          follows the reference and finds nothing. */}
      <RotateCw className={cn('size-3.5 transition-transform duration-[--duration-slow]', back && 'rotate-180')} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/** The grip that starts a drag. Split from the card body so a click on the flip button is never swallowed as a drag. */
export function CardDragHandle(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="Drag to assign"
      className="focus-ring shrink-0 cursor-grab rounded-lg p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
