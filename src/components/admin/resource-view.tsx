'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, LayoutGrid, List } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
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
  /**
   * Shown as fields in the card and as columns in the table, in this order.
   * `key` names the column for `sortHrefs` (the label is used when it is absent).
   */
  meta?: { key?: string; label: string; value: React.ReactNode; /** Only on the browser's card, never a table column (a long text). */ cardOnly?: boolean }[];
  actions?: ActionItem[];
};

/** A sortable column: where its header links to, and how the list is sorted by it now (see `sortToggle`). */
export type SortHref = { href: string; direction: 'asc' | 'desc' | null };

export function ResourceView({
  module,
  view,
  items,
  empty = 'Nothing here yet.',
  columns = 3,
  showCount = true,
  badgeHeader,
  sortHrefs,
  selectedId,
  openInPlace = false,
  toggle = true,
  dense = false,
  browser = false,
}: {
  /** Cookie key for the grid/list preference. */
  module: string;
  view: AdminView;
  items: ResourceItem[];
  /**
   * What to say when there is nothing here. A plain string keeps the old
   * behaviour; the object form gets the full `EmptyState` — icon, explanation
   * and the action that fills the screen.
   *
   * An empty list is almost always somebody's first visit to that screen, and
   * the one question they have is "so what do I do here" — which one line of
   * grey text was never going to answer.
   */
  empty?: string | EmptyStateProps;
  columns?: 2 | 3 | 4;
  /** Header for the badges column in table view. */
  badgeHeader?: string;
  /** Off when a ListToolbar above already reports the total, which is the real one when filters are applied. */
  showCount?: boolean;
  /** Table view: sortable column headers, keyed by `meta[].key` (or label), `title` for the Name column. */
  sortHrefs?: Record<string, SortHref>;
  /** The item whose card is open beside the list — highlighted and marked `aria-current`. */
  selectedId?: string | number | null;
  /**
   * Rows open a card on this page (a RouteSheet) rather than leave it: the
   * title link keeps the scroll position, stretches over the whole row and
   * carries `id="row-<item id>"`, which is where focus goes when the card closes.
   */
  openInPlace?: boolean;
  /** Off for a list that only makes sense as a table (a browser beside a tree). */
  toggle?: boolean;
  /**
   * Table view: compact rows (~40px), one-line subtitles, cells that never
   * wrap. For a table that shares the width with a tree — at 1280px the
   * browser's table gets about 660px, and wrapped cells pushed the last three
   * columns out of sight.
   */
  dense?: boolean;
  /**
   * The taxonomy browser's layout for any list (owner, 2026-11-16: "the
   * taxonomy view is the model for the whole admin"): a left rail of groups
   * with counts, a dense table, and the row's card in a sheet on demand.
   * See ResourceBrowser below. `true` groups rows by their first badge; the
   * object form can group by something else, or replace the rail with links
   * the page owns (another table, another query), and put a form above the table.
   */
  browser?: boolean | BrowserOptions;
}) {
  if (browser) return <ResourceBrowser items={items} empty={empty} badgeHeader={badgeHeader} {...(browser === true ? {} : browser)} />;
  const rowOptions = { selectedId: selectedId ?? null, openInPlace };
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
        {toggle ? <ViewToggle module={module} view={view} /> : null}
      </div>

      {items.length === 0 ? (
        typeof empty === 'string' ? <EmptyState title={empty} /> : <EmptyState {...empty} />
      ) : view === 'grid' && toggle ? (
        <ResourceGrid items={items} columns={columns} {...rowOptions} />
      ) : (
        <ResourceTable items={items} badgeHeader={badgeHeader} sortHrefs={sortHrefs} dense={dense} {...rowOptions} />
      )}
    </div>
  );
}

const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
};

type RowOptions = { selectedId: string | number | null; openInPlace: boolean };

/** The title link. In place: keeps the scroll, covers the whole row or card, and is where focus returns. */
function TitleLink({ item, openInPlace, selected, className }: { item: ResourceItem; openInPlace: boolean; selected: boolean; className: string }) {
  if (!item.href) return <span className={className}>{item.title}</span>;
  return (
    <Link
      href={item.href}
      id={openInPlace ? `row-${item.id}` : undefined}
      scroll={openInPlace ? false : undefined}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        className,
        openInPlace &&
          'after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:ring-2 focus-visible:after:ring-brand-500',
      )}
    >
      {item.title}
    </Link>
  );
}

function ResourceGrid({ items, columns, selectedId, openInPlace }: { items: ResourceItem[]; columns: 2 | 3 | 4 } & RowOptions) {
  return (
    <div className={cn('grid gap-3', GRID_COLUMNS[columns])}>
      {items.map((item, index) => (
        <Card
          key={item.id}
          padding="sm"
          interactive={Boolean(item.href)}
          // Capped at 8: past that the cascade stops reading as "arriving" and
          // starts reading as "slow", and a 200-row list would take four
          // seconds to finish appearing.
          style={{ '--stagger-index': Math.min(index, 8) } as React.CSSProperties}
          className={cn('animate-stagger group relative flex flex-col gap-3', item.id === selectedId && 'ring-2 ring-brand-500/60')}
        >
          <div className="flex items-start gap-3">
            {item.media ? <div className="shrink-0">{item.media}</div> : null}

            <div className="min-w-0 flex-1">
              {/* The title is the link, not the whole card: a card-wide anchor
                  would swallow the ⋯ menu and make text unselectable. (In
                  place, it does cover the card — the menu sits above it.) */}
              <TitleLink
                item={item}
                openInPlace={openInPlace}
                selected={item.id === selectedId}
                className="block truncate font-semibold transition-colors group-hover:text-brand-500 focus:outline-none focus-visible:underline"
              />
              {item.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{item.subtitle}</p> : null}
            </div>

            {item.actions?.length ? <div className="relative z-10"><ActionMenu items={item.actions} /></div> : null}
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

          {listMeta(item).length ? (
            <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              {listMeta(item).map((field) => (
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

function SortableTH({ label, sort, className }: { label: string; sort?: SortHref; className?: string }) {
  if (!sort) return <TH className={className}>{label}</TH>;
  const Icon = sort.direction === 'asc' ? ArrowUp : sort.direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <TH className={className} aria-sort={sort.direction === 'asc' ? 'ascending' : sort.direction === 'desc' ? 'descending' : undefined}>
      <Link
        href={sort.href}
        scroll={false}
        replace
        className={cn('inline-flex items-center gap-1 hover:text-slate-200', sort.direction && 'text-slate-200')}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <Icon className={cn('size-3', !sort.direction && 'opacity-40')} aria-hidden />
      </Link>
    </TH>
  );
}

function ResourceTable({
  items,
  badgeHeader = 'Status',
  sortHrefs,
  selectedId,
  openInPlace,
  dense = false,
}: { items: ResourceItem[]; badgeHeader?: string; sortHrefs?: Record<string, SortHref>; dense?: boolean } & RowOptions) {
  const cell = dense ? 'px-2.5 py-2 whitespace-nowrap' : undefined;
  // Dense tables drop an all-empty badge column: beside a tree every column
  // costs ~70px, and an empty one pushed the ⋯ menu out of sight.
  const badgeColumn = !dense || items.some((item) => item.badges?.length);
  // Columns come from the first item, so every item must describe the same
  // `meta` keys — which is a property of how a page builds its items, not
  // something this component can enforce.
  const columns = items[0] ? listMeta(items[0]).map((field) => ({ key: field.key ?? field.label, label: field.label })) : [];

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            <SortableTH label="Name" sort={sortHrefs?.title} className={cell} />
            {columns.map((column) => (
              <SortableTH key={column.key} label={column.label} sort={sortHrefs?.[column.key]} className={cell} />
            ))}
            {/* Not always "Status": menus put a visibility scope here, sales
                the payment gateway. Naming the column after whatever the badges
                actually are beats one label that is wrong on half the lists. */}
            {badgeColumn ? <TH className={cell}>{badgeHeader}</TH> : null}
            <TH className={cell} />
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={columns.length + (badgeColumn ? 3 : 2)}>Nothing here yet.</EmptyRow>
          ) : (
            items.map((item) => (
              <TR key={item.id} className={cn(openInPlace && 'relative', item.id === selectedId && 'bg-brand-500/10')}>
                <TD className={cell}>
                  <span className={cn('flex items-center gap-2', dense && 'max-w-[14rem]')}>
                    {item.media}
                    <span className="min-w-0">
                      <TitleLink
                        item={item}
                        openInPlace={openInPlace}
                        selected={item.id === selectedId}
                        className="block truncate font-medium hover:text-brand-600"
                      />
                      {item.subtitle ? <span className="block truncate text-xs text-slate-400">{item.subtitle}</span> : null}
                    </span>
                  </span>
                </TD>
                {listMeta(item).map((field) => (
                  <TD key={field.key ?? field.label} className={cell}>
                    {/* max-width on a <td> itself is not honoured in an auto-layout table; on a block inside it is. */}
                    {dense ? <span className="block max-w-[8.5rem] truncate">{field.value}</span> : field.value}
                  </TD>
                ))}
                {badgeColumn ? (
                  <TD className={cell}>
                    <span className={cn('flex gap-1', !dense && 'flex-wrap')}>
                      {item.badges?.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone} title={badge.title}>
                          {badge.label}
                        </Badge>
                      ))}
                    </span>
                  </TD>
                ) : null}
                <TD className={cn('text-right', cell)}>
                  <span className="relative z-10 inline-flex justify-end">{item.actions?.length ? <ActionMenu items={item.actions} /> : null}</span>
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

/** The fields a table or grid shows: all but the card-only ones. */
const listMeta = (item: ResourceItem) => (item.meta ?? []).filter((field) => !field.cardOnly);

/** The group a row belongs to in the browser rail, by default: its first badge — on nearly every list, its status. */
const firstBadge = (item: ResourceItem) => item.badges?.[0]?.label ?? 'Other';

/** A rail entry the page owns: a link, its count, and whether it is the page's current one. */
export type BrowserRailLink = { label: string; href: string; count?: number; active: boolean };

export type BrowserOptions = {
  /** Groups rows in the rail; default the first badge. */
  groupBy?: (item: ResourceItem) => string;
  /** Rail links instead of groups made from the rows (e.g. modifier types, each its own query). */
  rail?: BrowserRailLink[];
  /** The rail's label for screen readers and its heading. */
  railLabel?: string;
  /** Above the table: a create form, a note. */
  before?: React.ReactNode;
};

/**
 * Any admin list in the taxonomy browser's layout, with no code per list
 * (2026-11-16). The rail groups rows by their first badge (Active / Off,
 * Published / Draft, Paid / Pending…) with counts; a row opens its card in a
 * sheet — the item's own description, badges, fields and actions, and Open
 * for its editor. State is in the URL (`?group=`, `?open=`), so Back closes
 * the card and a view can be linked.
 */
function ResourceBrowser({
  items,
  empty,
  badgeHeader,
  groupBy = firstBadge,
  rail,
  railLabel = 'Groups',
  before,
}: {
  items: ResourceItem[];
  empty: string | EmptyStateProps;
  badgeHeader?: string;
} & BrowserOptions) {
  const groupOf = groupBy;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const group = search.get('group');
  const open = search.get('open');

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const counts = new Map<string, number>();
  for (const item of items) counts.set(groupOf(item), (counts.get(groupOf(item)) ?? 0) + 1);
  // With page-owned rail links the rows are already the selection; `group` is not used.
  const visible = group && !rail ? items.filter((item) => groupOf(item) === group) : items;
  const rows = visible.map((item) => ({ ...item, href: hrefWith({ open: String(item.id) }) }));
  const index = visible.findIndex((item) => String(item.id) === open);
  const current = index >= 0 ? visible[index] : null;
  const step = (to: ResourceItem | undefined) => (to ? () => router.replace(hrefWith({ open: String(to.id) }), { scroll: false }) : undefined);
  const close = () => {
    router.replace(hrefWith({ open: null }), { scroll: false });
    // Back on the row that was open, as in the taxonomy browser.
    if (current) requestAnimationFrame(() => document.getElementById(`row-${current.id}`)?.focus());
  };

  const railLink = (key: string | null, label: string, count: number) => {
    const active = group === key;
    return (
      <Link
        key={key ?? 'all'}
        href={hrefWith({ group: key, open: null })}
        scroll={false}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-control px-2 py-1 text-sm transition-colors duration-[--duration-fast]',
          active ? 'bg-brand-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
          key === null && 'font-semibold',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="font-mono text-[11px] text-slate-500">{count}</span>
      </Link>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
      <nav aria-label={railLabel} className="mb-4 lg:mb-0">
        <div className="flex flex-wrap gap-1 lg:sticky lg:top-20 lg:flex-col lg:flex-nowrap">
          <p className="eyebrow mb-1 hidden px-2 lg:block">{railLabel}</p>
          {rail
            ? rail.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  scroll={false}
                  aria-current={link.active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-control px-2 py-1 text-sm capitalize transition-colors duration-[--duration-fast]',
                    link.active ? 'bg-brand-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  {link.count !== undefined ? <span className="font-mono text-[11px] text-slate-500">{link.count}</span> : null}
                </Link>
              ))
            : [railLink(null, 'All', items.length), ...[...counts.entries()].map(([key, count]) => railLink(key, key, count))]}
        </div>
      </nav>

      <div className="min-w-0">
        {before ? <div className="mb-4">{before}</div> : null}
        {visible.length === 0 ? (
          typeof empty === 'string' ? <EmptyState title={empty} /> : <EmptyState {...empty} />
        ) : (
          <ResourceTable items={rows} badgeHeader={badgeHeader} dense selectedId={current?.id ?? null} openInPlace />
        )}
      </div>

      {current ? (
        <Sheet
          open
          onClose={close}
          title={current.title}
          // A list that puts the whole text on the card (cardOnly) needs no teaser of it in the header.
          subtitle={current.meta?.some((field) => field.cardOnly) ? undefined : current.subtitle ?? undefined}
          actions={
            <>
              <span className="mr-1 font-mono text-[11px] text-slate-500">
                {index + 1}/{visible.length}
              </span>
              <StepButton label="Previous" onClick={step(visible[index - 1])} icon={<ChevronUp className="size-4" />} />
              <StepButton label="Next" onClick={step(visible[index + 1])} icon={<ChevronDown className="size-4" />} />
            </>
          }
          footer={
            items.find((i) => i.id === current.id)?.href ? (
              <Link
                href={items.find((i) => i.id === current.id)!.href!}
                className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700"
              >
                <ExternalLink className="size-3.5" /> Open
              </Link>
            ) : undefined
          }
        >
          <ItemCard item={current} />
        </Sheet>
      ) : null}
    </div>
  );
}

function StepButton({ label, onClick, icon }: { label: string; onClick?: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors enabled:hover:bg-white/5 enabled:hover:text-slate-200 disabled:opacity-30"
    >
      {icon}
    </button>
  );
}

/** The card in the sheet, from what the list already knows about the row. */
function ItemCard({ item }: { item: ResourceItem }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-start gap-3">
        {item.media ? <div className="shrink-0">{item.media}</div> : null}
        {item.badges?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.badges.map((badge) => (
              <Badge key={badge.label} tone={badge.tone} title={badge.title}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {item.meta?.length ? (
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2">
          {item.meta.map((field) => (
            <div key={field.key ?? field.label} className="contents">
              <dt className="text-slate-500 dark:text-slate-400">{field.label}</dt>
              <dd className="min-w-0 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {item.actions?.length ? (
        <div>
          <p className="eyebrow mb-2">Actions</p>
          <div className="flex flex-wrap gap-2">
            {item.actions.map((action) =>
              action.href ? (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-control border border-slate-200 px-2.5 text-xs font-semibold hover:bg-white/[0.03] dark:border-white/10"
                >
                  {action.icon}
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => {
                    if (action.danger && !window.confirm(`${action.label}: are you sure?`)) return;
                    action.onSelect?.();
                  }}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40',
                    action.danger ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border-slate-200 hover:bg-white/[0.03] dark:border-white/10',
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
