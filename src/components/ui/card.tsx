import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The one surface recipe.
 *
 * There used to be four, from drift rather than intent: this file's
 * `dark:bg-slate-900`, the nicer `dark:bg-white/[0.03] dark:backdrop-blur-md`
 * that only `Stat` used, a near-copy of that in the bot converter with a
 * different border opacity, and the input/panel recipe re-typed by hand in
 * five places. On one screen that reads as three slightly different greys with
 * no rule explaining which is which.
 *
 * The glass recipe wins because it is the one that works on both grounds: a
 * translucent white lifts off whatever is behind it, where an opaque
 * `slate-900` only looks right on exactly the background it was picked
 * against — and the admin's `.admin-console` re-binds `--color-slate-900` to
 * near-black, so that assumption was already false there.
 *
 * `padding` exists because every caller was passing `p-4` or `p-5` by hand,
 * which is a default with extra steps.
 */

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export type CardProps = React.ComponentProps<'div'> & {
  /** Adds a hover response. Only for cards that are a link or a button — a hover that leads nowhere is a lie. */
  interactive?: boolean;
  padding?: keyof typeof PADDING;
};

export function Card({ className, interactive, padding = 'none', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-slate-200/80 bg-white shadow-sm',
        'dark:border-white/10 dark:bg-white/[0.03] dark:backdrop-blur-md',
        PADDING[padding],
        interactive &&
          'transition duration-[--duration-base] ease-[--ease-out] hover:border-brand-400 hover:shadow-md dark:hover:border-brand-500/40 dark:hover:bg-white/[0.055]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-semibold leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-slate-500 dark:text-slate-400', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}
