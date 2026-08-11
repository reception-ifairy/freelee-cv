import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listHref, pageInfo, type ListConfig, type ListParams } from '@/lib/admin/list-query';
import { cn } from '@/lib/utils';

/**
 * Plain links, rendered on the server — not buttons calling a router.
 *
 * Which means paging works with JavaScript disabled, each page is a real URL
 * you can bookmark or hand to someone, and the browser prefetches the next page
 * on hover for free.
 */
export function ListPagination({
  pathname,
  params,
  config,
  total,
}: {
  pathname: string;
  params: ListParams;
  config: ListConfig;
  total: number;
}) {
  const { from, to, pages } = pageInfo(params, total);
  if (pages <= 1) return null;

  const href = (page: number) => listHref(pathname, params, config, { page });

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <strong>{from.toLocaleString('en-GB')}</strong>–<strong>{to.toLocaleString('en-GB')}</strong> of{' '}
        <strong>{total.toLocaleString('en-GB')}</strong>
      </p>

      <div className="flex items-center gap-1">
        <PageLink href={href(params.page - 1)} disabled={params.page <= 1} label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>

        {windowOf(params.page, pages).map((page, index) =>
          page === null ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
              …
            </span>
          ) : (
            <Link
              key={page}
              href={href(page)}
              aria-current={page === params.page ? 'page' : undefined}
              className={cn(
                'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-medium transition',
                page === params.page
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              )}
            >
              {page}
            </Link>
          ),
        )}

        <PageLink href={href(params.page + 1)} disabled={params.page >= pages} label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  // A disabled link is a span, not an anchor with a dead href — otherwise it is
  // still focusable and still announced as a link.
  if (disabled) {
    return (
      <span aria-hidden className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-700">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}

/**
 * First, last, and a window around the current page — so 200 pages render about
 * nine links rather than two hundred. `null` is a gap.
 */
function windowOf(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const out: (number | null)[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);

  if (start > 2) out.push(null);
  for (let page = start; page <= end; page++) out.push(page);
  if (end < pages - 1) out.push(null);

  out.push(pages);
  return out;
}
