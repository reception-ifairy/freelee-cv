import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Placeholder shapes for content that has not arrived.
 *
 * There was no loading vocabulary at all before this: no `loading.tsx`
 * anywhere in the app, no `Suspense`, no skeletons. Navigating between admin
 * pages froze the previous screen until the server answered, which reads as a
 * broken click rather than a slow one.
 *
 * The skeleton mirrors the *shape* of what is coming — card grid, table rows,
 * stat row — rather than being a generic spinner, so the layout does not jump
 * when real content replaces it, and the eye already knows where to look.
 */

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // aria-hidden: a screen reader should hear the page's own loading
      // announcement, not a description of grey rectangles.
      aria-hidden
      className={cn('animate-shimmer rounded-md bg-slate-200/60 dark:bg-white/[0.06]', className)}
      {...props}
    />
  );
}

/** Matches `PageHeader` — title, description, and the actions slot. */
export function SkeletonHeader() {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-control" />
    </div>
  );
}

/** Matches a `ResourceView` grid card: media, title, subtitle, badges, meta. */
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-slate-200/80 p-4 dark:border-white/10">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 dark:border-white/5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, columns = 3 }: { count?: number; columns?: 2 | 3 | 4 }) {
  const cols =
    columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-3';
  return (
    <div className={cn('grid gap-4', cols)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Matches the table view, including its header row. */
export function SkeletonTable({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-slate-200/80 dark:border-white/10">
      <div className="flex gap-4 border-b border-slate-200/80 p-3 dark:border-white/10">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-slate-100 p-3 last:border-0 dark:border-white/5">
          {Array.from({ length: columns }, (_, c) => (
            // The first column carries a name and is visibly wider than the
            // rest — an even grid reads as a spreadsheet, not this table.
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Matches the dashboard/sales row of `StatTile`s. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-slate-200/80 p-5 dark:border-white/10">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

/** The default whole-screen fallback: header plus a list. */
export function SkeletonListPage({ view = 'grid', columns = 3 }: { view?: 'grid' | 'table'; columns?: 2 | 3 | 4 }) {
  return (
    <div>
      <SkeletonHeader />
      <Skeleton className="mb-4 h-11 w-full rounded-control" />
      {view === 'table' ? <SkeletonTable /> : <SkeletonGrid columns={columns} />}
    </div>
  );
}
