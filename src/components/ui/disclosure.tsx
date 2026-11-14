'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A section that folds: a heading row you click, and content under it.
 *
 * Built on <details>/<summary> on purpose, not on state:
 * - it opens and closes before hydration, and server components can fill it;
 * - the browser's find-in-page (Ctrl+F) opens a folded section when the match
 *   is inside it — content hidden by a `useState` panel is simply not found;
 * - keyboard and screen-reader behaviour (Enter/Space, "collapsed/expanded")
 *   come with the element.
 *
 * The open/close animation is CSS (`.disclosure` in globals.css, via
 * `::details-content`); browsers without it just open instantly.
 *
 * `defaultOpen` can only ever *open* the section after the first render, never
 * close it. A server page re-renders it on every soft navigation; passed
 * straight to <details open>, a section opened for a card (`?open=…`) snapped
 * shut again the moment the card closed — taking the row that should get focus
 * back with it — and a section the reader opened by hand could be shut by a
 * re-render. So the element's own state is kept, and a `defaultOpen` that turns
 * true opens it.
 *
 * `name` makes a group exclusive — opening one closes the others with the same
 * name (native <details name>).
 */
export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  name,
  id,
  className,
  summaryClassName,
  children,
}: {
  title: React.ReactNode;
  /** Right-aligned beside the title — a count, a badge. */
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  name?: string;
  id?: string;
  className?: string;
  summaryClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [askedOpen, setAskedOpen] = useState(defaultOpen);
  if (defaultOpen !== askedOpen) {
    setAskedOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }

  return (
    <details
      id={id}
      name={name}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn('disclosure group/disclosure', className)}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 rounded-control px-2 py-2 text-sm font-semibold transition-colors duration-[--duration-fast] select-none hover:bg-slate-100 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden',
          summaryClassName,
        )}
      >
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-slate-400 transition-transform duration-[--duration-fast] group-open/disclosure:rotate-90"
        />
        <span className="min-w-0 flex-1">{title}</span>
        {meta ? <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-slate-500 dark:text-slate-400">{meta}</span> : null}
      </summary>
      <div className="pt-2 pb-1">{children}</div>
    </details>
  );
}
