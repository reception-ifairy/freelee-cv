/**
 * Search, filter, sort and pagination state for admin lists.
 *
 * **State lives in the URL**, not in React state. That is the whole design:
 *
 *  - a filtered view is a link — bookmarkable, shareable, survives a reload
 *  - the back button works
 *  - the **server** does the filtering in SQL, so a list of 5,000 personas
 *    never has to be loaded into memory to show 24 of them
 *
 * Plain module — parsed on the server, serialised by the client toolbar. No
 * `next/headers`, no `server-only`; see docs/35-admin-lists.md for what happens
 * when that boundary is got wrong (three times now).
 */

export const PAGE_SIZES = [24, 48, 96] as const;
export const DEFAULT_PAGE_SIZE = 24;

/** One dropdown in the toolbar. `''` always means "no filter". */
export type FilterDef = {
  key: string;
  label: string;
  options: { id: string; label: string }[];
};

export type SortDef = { id: string; label: string };

export type ListConfig = {
  filters: FilterDef[];
  sorts: SortDef[];
  defaultSort: string;
};

export type ListParams = {
  q: string;
  sort: string;
  page: number;
  perPage: number;
  filters: Record<string, string>;
};

/** Next.js hands repeated params as arrays; only the first value is ever meaningful here. */
function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function parseListParams(
  searchParams: Record<string, string | string[] | undefined>,
  config: ListConfig,
): ListParams {
  const rawPage = Number(first(searchParams.page));
  const rawPer = Number(first(searchParams.per));
  const sort = first(searchParams.sort);

  const filters: Record<string, string> = {};
  for (const filter of config.filters) {
    const value = first(searchParams[filter.key]);
    // Only values the filter actually offers are accepted. A hand-edited URL
    // then narrows nothing instead of reaching the query with junk.
    if (value && filter.options.some((option) => option.id === value)) filters[filter.key] = value;
  }

  return {
    q: first(searchParams.q).trim().slice(0, 100),
    sort: config.sorts.some((s) => s.id === sort) ? sort : config.defaultSort,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    perPage: (PAGE_SIZES as readonly number[]).includes(rawPer) ? rawPer : DEFAULT_PAGE_SIZE,
    filters,
  };
}

/** Builds a query string, omitting anything at its default so URLs stay short and readable. */
export function listHref(
  pathname: string,
  params: ListParams,
  config: ListConfig,
  overrides: Partial<ListParams> & { filters?: Record<string, string> } = {},
): string {
  const next: ListParams = {
    ...params,
    ...overrides,
    filters: { ...params.filters, ...(overrides.filters ?? {}) },
  };

  const search = new URLSearchParams();
  if (next.q) search.set('q', next.q);
  if (next.sort !== config.defaultSort) search.set('sort', next.sort);
  if (next.perPage !== DEFAULT_PAGE_SIZE) search.set('per', String(next.perPage));
  for (const [key, value] of Object.entries(next.filters)) {
    if (value) search.set(key, value);
  }
  // Page last, so it reads at the end of the URL — and never `page=1`.
  if (next.page > 1) search.set('page', String(next.page));

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function hasActiveFilters(params: ListParams): boolean {
  return Boolean(params.q) || Object.values(params.filters).some(Boolean);
}

/** `{ from, to, total, pages }` for "showing 25–48 of 312". */
export function pageInfo(params: ListParams, total: number) {
  const pages = Math.max(1, Math.ceil(total / params.perPage));
  const from = total === 0 ? 0 : (params.page - 1) * params.perPage + 1;
  const to = Math.min(total, params.page * params.perPage);
  return { from, to, total, pages };
}
