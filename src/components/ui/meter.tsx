import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A number, given a shape.
 *
 * The admin is full of figures that exist only to be compared and are rendered
 * as text: sector suitability as the string `"70 / 40 / 20"`, credit balances,
 * persona counts per category, views per post. A reader cannot rank those by
 * eye; a bar they can rank without reading at all.
 *
 * `ResourceItem.meta.value` has always been typed `React.ReactNode`, so this
 * drops into all sixteen admin lists with no change to the list contract.
 *
 * The number stays beside the bar rather than being replaced by it. A bar is
 * good at "more than that one" and bad at "how many exactly", and admin work
 * needs both.
 */

const TONES = {
  brand: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
} as const;

export type MeterTone = keyof typeof TONES;

export type MeterProps = {
  value: number;
  /** The scale to fill against — usually the largest value on the page, so bars are comparable across rows. */
  max: number;
  tone?: MeterTone;
  /** Text shown beside the bar. Pass a formatted string; pass null to show the bar alone. */
  display?: React.ReactNode;
  /** A short name for the quantity, for screen readers. */
  label?: string;
  className?: string;
};

export function Meter({ value, max, tone = 'brand', display, label, className }: MeterProps) {
  // Guard the whole range: a max of 0 (an empty page, a fresh install) would
  // otherwise divide by zero, and a value above max would overflow the track.
  const safeMax = max > 0 ? max : 1;
  const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
      >
        {/* A zero-width bar is invisible and reads as "missing" rather than
            "none", so anything above zero keeps a 2px stub. */}
        <span
          className={cn('block h-full rounded-full transition-[width] duration-[--duration-slow] ease-[--ease-out]', TONES[tone])}
          style={{ width: percent === 0 && value > 0 ? '2px' : `${percent}%` }}
        />
      </span>
      {display !== null ? (
        <span className="shrink-0 font-medium tabular-nums">{display ?? value}</span>
      ) : null}
    </span>
  );
}

/**
 * Several meters sharing one scale — the shape sector suitability wanted all
 * along. Rendering three 0–100 scores as `"70 / 40 / 20"` asks the reader to
 * do the comparison the bars do for free.
 */
export function MeterGroup({
  items,
  max = 100,
  className,
}: {
  items: { label: string; value: number; tone?: MeterTone }[];
  max?: number;
  className?: string;
}) {
  return (
    <span className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-7 shrink-0 text-slate-400">{item.label}</span>
          <Meter value={item.value} max={max} tone={item.tone} label={item.label} />
        </span>
      ))}
    </span>
  );
}
