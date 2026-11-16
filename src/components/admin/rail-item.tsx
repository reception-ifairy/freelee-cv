'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One entry of a browser's left rail — a group, a status, a folder — styled as
 * the taxonomy tree's lines (freelee #90–#92), so every rail in the admin
 * reads the same: label, count on the right, the current one tinted.
 * A link when the choice lives in the URL; a button when it is local state.
 */
export function RailItem({
  label,
  count,
  active,
  href,
  onClick,
  strong = false,
  className,
  icon: Icon,
  meta,
  title,
}: {
  label: string;
  /** A small icon before the label (the Settings tree). */
  icon?: LucideIcon;
  /** Text in the count's place, when it is not a plain number ("2/6"). */
  meta?: string;
  /** Tooltip: what the entry is, when the label alone does not say. */
  title?: string;
  count?: number;
  active: boolean;
  href?: string;
  onClick?: () => void;
  strong?: boolean;
  className?: string;
}) {
  const classes = cn(
    'flex items-center gap-2 rounded-control px-2 py-1 text-left text-sm transition-colors duration-[--duration-fast]',
    active ? 'bg-brand-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
    strong && 'font-semibold',
    className,
  );
  const body = (
    <>
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined || meta ? <span className="font-mono text-[11px] text-slate-500">{meta ?? count}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} scroll={false} aria-current={active ? 'page' : undefined} title={title} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-pressed={active} title={title} className={classes}>
      {body}
    </button>
  );
}
