import * as React from 'react';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Card } from './card';
import { Sparkline } from './sparkline';
import { cn } from '@/lib/utils';

/**
 * A headline number.
 *
 * Replaces `Stat` from `admin/page-header.tsx`, which was label + number and
 * nothing else — so "Revenue £4,210" told you the figure and never whether
 * that was a good week or a bad one. A number with no comparison is a fact
 * without a meaning, and every one of these tiles sits on a screen whose whole
 * job is noticing change.
 *
 * `trend` and `spark` are both optional and independent: some figures have a
 * meaningful previous period, some have a shape over time, a few have both,
 * and totals-to-date honestly have neither.
 */

export type StatTileProps = {
  label: string;
  /** Pre-formatted — callers own currency, locale and units. */
  value: string;
  /** Secondary line under the value. */
  hint?: string;
  icon?: LucideIcon;
  /**
   * Change against the previous comparable period, as a percentage.
   * Positive is drawn green and negative red **unless** `invert` says
   * otherwise — for refunds or failed payments, up is bad.
   */
  trend?: { percent: number; label?: string; invert?: boolean };
  /** Oldest first. Rendered as a sparkline under the value. */
  spark?: number[];
  className?: string;
};

export function StatTile({ label, value, hint, icon: Icon, trend, spark, className }: StatTileProps) {
  return (
    <Card padding="md" className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {Icon ? <Icon className="size-4 shrink-0 text-slate-400 dark:text-slate-600" /> : null}
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>

      {trend ? <Trend {...trend} /> : null}

      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}

      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-3">
          <Sparkline values={spark} label={`${label} over time`} />
        </div>
      ) : null}
    </Card>
  );
}

function Trend({ percent, label, invert }: NonNullable<StatTileProps['trend']>) {
  // Exactly zero is neither good nor bad and gets the neutral treatment —
  // painting "no change" green would be a small lie told very often.
  const flat = Math.round(percent) === 0;
  const good = invert ? percent < 0 : percent > 0;
  const Icon = percent >= 0 ? TrendingUp : TrendingDown;

  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1 text-xs font-medium tabular-nums',
        flat
          ? 'text-slate-500 dark:text-slate-400'
          : good
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {flat ? null : <Icon className="size-3.5 shrink-0" />}
      {percent > 0 ? '+' : ''}
      {Math.round(percent)}%
      {label ? <span className="font-normal text-slate-500 dark:text-slate-400">{label}</span> : null}
    </p>
  );
}
