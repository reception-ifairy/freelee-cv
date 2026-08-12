import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A trend line, drawn as inline SVG.
 *
 * No charting library, matching the decision already written into the
 * dashboard's bar chart: "no charting dependency to keep updated". A
 * sparkline is a polyline through normalised points — about thirty lines of
 * real work — and the smallest chart library that could draw one is two
 * orders of magnitude more code, plus a version to track forever.
 *
 * It is deliberately unlabelled. A sparkline answers "which way, and how
 * steadily" at a glance; the moment it needs axes and a legend it has stopped
 * being a sparkline and wants to be the real chart on the next screen.
 */

export type SparklineProps = {
  /** Oldest first. Fewer than two points renders nothing — one point has no shape. */
  values: number[];
  className?: string;
  /** Filled area under the line. Off for dense rows, on for a lone stat tile. */
  area?: boolean;
  /** Accessible summary. Without it the SVG is hidden from screen readers, which is correct for pure decoration beside a number that already says the value. */
  label?: string;
};

export function Sparkline({ values, className, area = true, label }: SparklineProps) {
  if (values.length < 2) return null;

  // A fixed viewBox with `preserveAspectRatio="none"` lets the caller size it
  // with CSS alone. The stroke is vector-effect'd so it stays 1.5px however
  // hard the box is squashed.
  const width = 100;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; drawing it through the middle is the
  // honest picture of "no change" rather than pinning it to the floor.
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, i) => {
    const x = i * step;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-8 w-full overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {area ? (
        <polygon
          points={`0,${height} ${points.join(' ')} ${width},${height}`}
          className="fill-brand-500/15"
        />
      ) : null}
      <polyline
        points={points.join(' ')}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-500"
      />
    </svg>
  );
}
