'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, List } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { ActionMenu, type ActionItem } from '@/components/ui/action-menu';
import { VIEW_COOKIE_PREFIX, type AdminView } from '@/lib/admin/view-preference';
import { cn } from '@/lib/utils';

export type BadgeTone = 'brand' | 'green' | 'amber' | 'rose' | 'slate';

/**
 * One row/card, described once and rendered either way.
 *
 * Every admin list page used to hand-write its own `<Table>` with its own
 * column set and its own row of loose icon buttons. Describing an item once and
 * letting this component render it means the grid and the table cannot drift
 * apart, and a change to either applies everywhere at once.
 */
export type ResourceItem = {
  id: string | number;
  title: string;
  subtitle?: string | null;
  /** Makes the whole card/row clickable. */
  href?: string;
  /** Avatar, icon or colour swatch. */
  media?: React.ReactNode;
  badges?: { label: string; tone?: BadgeTone; title?: string }[];
  /** Shown as fields in the card and as columns in the table, in this order. */
  meta?: { label: string; value: React.ReactNode }[];
  actions?: ActionItem[];
};

export function ResourceView({
  module,
  view,
  items,
  empty = 'Nothing here yet.',
  columns = 3,
  showCount = true,
}: {
  /** Cookie key for the grid/list preference. */
  module: string;
  view: AdminView;
  items: ResourceItem[];
  empty?: string;
  columns?: 2 | 3 | 4;
  /** Off when a ListToolbar above already reports the total, which is the real one when filters are applied. */
  showCount?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {showCount ? (
          <p className="text-xs text-slate-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        ) : (
          <span />
        )}
        <ViewToggle module={module} view={view} />
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          {empty}
        </p>
      ) : view === 'grid' ? (
        <ResourceGrid items={items} columns={columns} />
      ) : (
        <ResourceTable items={items} />
      )}
    </div>
  );
}

const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
};

function ResourceGrid({ items, columns }: { items: ResourceItem[]; columns: 2 | 3 | 4 }) {
  return (
    <div className={cn('grid gap-3', GRID_COLUMNS[columns])}>
      {items.map((item) => (
        <Card key={item.id} className="group relative flex flex-col gap-3 p-4 transition hover:border-brand-400">
          <div className="flex items-start gap-3">
            {item.media ? <div className="shrink-0">{item.media}</div> : null}

            <div className="min-w-0 flex-1">
              {/* The title is the link, not the whole card: a card-wide anchor
                  would swallow the ⋯ menu and make text unselectable. */}
              {item.href ? (
                <Link href={item.href} className="block truncate font-semibold hover:text-brand-600 focus:outline-none focus-visible:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="truncate font-semibold">{item.title}</p>
              )}
              {item.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{item.subtitle}</p> : null}
            </div>

            {item.actions?.length ? <ActionMenu items={item.actions} /> : null}
          </div>

          {item.badges?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {item.badges.map((badge) => (
                <Badge key={badge.label} tone={badge.tone} title={badge.title}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {item.meta?.length ? (
            <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              {item.meta.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="truncate text-slate-400">{field.label}</dt>
                  <dd className="truncate font-medium">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function ResourceTable({ items }: { items: ResourceItem[] }) {
  // Columns come from the first item, so every item must describe the same
  // `meta` keys — which is a property of how a page builds its items, not
  // something this component can enforce.
  const columns = items[0]?.meta?.map((field) => field.label) ?? [];

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            <TH>Name</TH>
            {columns.map((label) => (
              <TH key={label}>{label}</TH>
            ))}
            <TH>Status</TH>
            <TH />
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={columns.length + 3}>Nothing here yet.</EmptyRow>
          ) : (
            items.map((item) => (
              <TR key={item.id}>
                <TD>
                  <span className="flex items-center gap-2">
                    {item.media}
                    <span className="min-w-0">
                      {item.href ? (
                        <Link href={item.href} className="block truncate font-medium hover:text-brand-600">
                          {item.title}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium">{item.title}</span>
                      )}
                      {item.subtitle ? <span className="block truncate text-xs text-slate-400">{item.subtitle}</span> : null}
                    </span>
                  </span>
                </TD>
                {(item.meta ?? []).map((field) => (
                  <TD key={field.label}>{field.value}</TD>
                ))}
                <TD>
                  <span className="flex flex-wrap gap-1">
                    {item.badges?.map((badge) => (
                      <Badge key={badge.label} tone={badge.tone} title={badge.title}>
                        {badge.label}
                      </Badge>
                    ))}
                  </span>
                </TD>
                <TD className="text-right">
                  <span className="inline-flex justify-end">{item.actions?.length ? <ActionMenu items={item.actions} /> : null}</span>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </Card>
  );
}

/**
 * Writes the preference to a cookie and refreshes, so the **server** renders the
 * chosen view on the next load. See lib/admin/view-preference.ts for why this
 * is not localStorage.
 */
export function ViewToggle({ module, view }: { module: string; view: AdminView }) {
  const router = useRouter();

  function choose(next: AdminView) {
    if (next === view) return;
    document.cookie = `${VIEW_COOKIE_PREFIX}${module}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="View">
      {(
        [
          { key: 'grid' as const, label: 'Grid', icon: <LayoutGrid className="size-3.5" /> },
          { key: 'list' as const, label: 'List', icon: <List className="size-3.5" /> },
        ]
      ).map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => choose(option.key)}
          aria-pressed={view === option.key}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
            view === option.key
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
