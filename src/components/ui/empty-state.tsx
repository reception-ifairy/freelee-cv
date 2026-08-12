import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * What a screen says when it has nothing to show.
 *
 * Every empty view in the admin used to be one line of grey text inside a
 * dashed box — "Nothing here yet." — repeated across sixteen lists and a dozen
 * hand-rolled panels. That is the least useful moment to say the least useful
 * thing: an empty list is almost always someone's *first* visit to that
 * screen, and the one question they have is "so what do I do here".
 *
 * Hence the shape: an icon so the screen is recognisable at a glance, a
 * sentence explaining what belongs here, and — where there is one — the action
 * that fills it.
 */

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One sentence on what this screen holds and why it is empty. */
  description?: string;
  /** The action that fills it. Omit when there is nothing the reader can do from here. */
  action?: { label: string; href: string };
  /** Rendered under the action — a secondary link, a hint, a filter reset. */
  children?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-slate-300 px-6 py-14 text-center dark:border-white/15',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500">
          <Icon className="size-5" />
        </span>
      ) : null}

      <p className="text-sm font-semibold">{title}</p>

      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}

      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-10 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
        >
          {action.label}
        </Link>
      ) : null}

      {children ? <div className="mt-4 text-xs text-slate-400">{children}</div> : null}
    </div>
  );
}
