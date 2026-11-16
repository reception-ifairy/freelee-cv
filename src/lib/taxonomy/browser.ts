/**
 * The taxonomy browser's state and tree (owner, 2026-11-14: "instead of the
 * card view, a system that makes browsing clear, with the card opening on
 * demand"). Plain module — no database, no `server-only` — so the server page,
 * the client tree and `scripts/verify-taxonomy-browser.ts` share it.
 *
 * All state is in the URL, read by the server:
 *
 *   /admin/taxonomy?cat=34&sec=42&tab=sectors&q=…&status=live&sort=…&page=2&open=persona-123
 *
 * - `cat` — a category id (or its slug, for stable links), or `none` for
 *   personas filed under no category. Since 2026-11-16 the categories are the
 *   platform's pillars, and a picked category is its workspace;
 * - `tab` — what the right-hand side shows. Lists: `personas` and `sectors`.
 *   For a picked category also `agent` (its AI agent — the category's
 *   default screen since 2026-11-16), `audiences` and `brief`; for the
 *   category with the homeschool hub (category-extras.ts) `tutors`,
 *   `curriculum` and `families`. Everywhere else `personas` is the default.
 *   The default is left out of the URL, so `?cat=34` is the agent and the
 *   category's bot list is `?cat=34&tab=personas`;
 * - `sec` — a sector id (its category is implied, and corrected if `cat` disagrees);
 * - `q`, filters, `sort`, `page`, `per` — the list (src/lib/admin/list-query.ts);
 * - `open` — the card in the sheet: `persona-123` or `sector-42`.
 */
import { listHref, parseListParams, type ListConfig, type ListParams } from '@/lib/admin/list-query';
import { extrasFor } from './category-extras';

export const BROWSER_PATH = '/admin/taxonomy';

export const LIST_TABS = ['personas', 'sectors'] as const;
/** Tabs that belong to one picked category (no sector), not to a list. */
export const CATEGORY_TABS = ['audiences', 'agent', 'brief'] as const;
/** Tabs of the category that carries the homeschool hub. */
export const HUB_TABS = ['tutors', 'curriculum', 'families'] as const;
export type BrowserTab = (typeof LIST_TABS)[number] | (typeof CATEGORY_TABS)[number] | (typeof HUB_TABS)[number];
export const isListTab = (tab: BrowserTab) => tab === 'personas' || tab === 'sectors';
export type CategorySelection = number | 'none' | null;
export type Selection = { cat: CategorySelection; sec: number | null; tab: BrowserTab };
export type OpenRef = { kind: 'persona' | 'sector'; id: number };

export type TreeCategoryInput = {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
  riskLevel: string | null;
};
export type TreeSectorInput = { id: number; categoryId: number; name: string; isActive: boolean; riskLevel: string | null };
/** One row of the counts query: per (category, sector), per category, and overall (GROUPING SETS). */
export type CountRow = { level: 'pair' | 'category' | 'all'; categoryId: number | null; sectorId: number | null; total: number; live: number };

export type Count = { total: number; live: number };
export type SectorNode = TreeSectorInput & Count;
export type CategoryNode = TreeCategoryInput & Count & { sectors: SectorNode[]; unfiled: Count };
export type Tree = { categories: CategoryNode[]; all: Count; uncategorised: Count; sectorCount: number };

const ZERO: Count = { total: 0, live: 0 };

/** Joins categories, sectors and the counts into the tree the browser draws. Missing counts are zero. */
export function buildTree(categories: TreeCategoryInput[], sectors: TreeSectorInput[], counts: CountRow[]): Tree {
  const pick = (row: CountRow | undefined): Count => (row ? { total: row.total, live: row.live } : ZERO);
  const pair = new Map(counts.filter((c) => c.level === 'pair').map((c) => [`${c.categoryId}:${c.sectorId}`, c]));
  const byCategory = new Map(counts.filter((c) => c.level === 'category').map((c) => [c.categoryId, c]));

  return {
    categories: categories.map((category) => ({
      ...category,
      ...pick(byCategory.get(category.id)),
      sectors: sectors
        .filter((s) => s.categoryId === category.id)
        .map((s) => ({ ...s, ...pick(pair.get(`${category.id}:${s.id}`)) })),
      unfiled: pick(pair.get(`${category.id}:null`)),
    })),
    all: pick(counts.find((c) => c.level === 'all')),
    uncategorised: pick(byCategory.get(null)),
    sectorCount: sectors.length,
  };
}

const KEEP = ['cat', 'sec', 'tab'];

export const PERSONA_LIST: ListConfig = {
  filters: [
    { key: 'status', label: 'Status', options: [{ id: 'live', label: 'Live' }, { id: 'draft', label: 'Not live' }] },
    {
      key: 'audience',
      label: 'Audience',
      options: [
        { id: 'B2C', label: 'Consumer (B2C)' },
        { id: 'B2B', label: 'Business (B2B)' },
        { id: 'B2G', label: 'Government (B2G)' },
      ],
    },
    { key: 'kind', label: 'Kind', options: [{ id: 'tutor', label: 'Curriculum tutors' }, { id: 'other', label: 'Not tutors' }] },
    // Groups of another audience type are stored but never reach the prompt (#77); the dashboard links here.
    { key: 'groups', label: 'Audience groups', options: [{ id: 'other-type', label: 'Holding another type' }] },
  ],
  sorts: [
    { id: 'name', label: 'Sort: name A–Z' },
    { id: 'name-desc', label: 'Sort: name Z–A' },
    { id: 'popular', label: 'Sort: most messages' },
    { id: 'quiet', label: 'Sort: fewest messages' },
    { id: 'newest', label: 'Sort: newest first' },
  ],
  defaultSort: 'name',
  keep: KEEP,
};

export const SECTOR_LIST: ListConfig = {
  filters: [{ key: 'status', label: 'Status', options: [{ id: 'active', label: 'Active' }, { id: 'off', label: 'Switched off' }] }],
  sorts: [
    { id: 'position', label: 'Sort: catalogue order' },
    { id: 'name', label: 'Sort: name A–Z' },
    { id: 'name-desc', label: 'Sort: name Z–A' },
    { id: 'personas', label: 'Sort: most personas' },
    { id: 'personas-asc', label: 'Sort: fewest personas' },
  ],
  defaultSort: 'position',
  keep: KEEP,
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function parseOpen(value: string | string[] | undefined): OpenRef | null {
  const match = /^(persona|sector)-(\d{1,9})$/.exec(first(value));
  return match ? { kind: match[1] as OpenRef['kind'], id: Number(match[2]) } : null;
}

export const openKey = (ref: OpenRef) => `${ref.kind}-${ref.id}`;

/**
 * Reads the URL against the tree. Unknown ids are dropped (the page shows the
 * level above rather than an empty list), a sector brings its own category,
 * and the kept params are rewritten from the result — so every link built
 * from `params` carries only what was understood.
 */
export function parseBrowser(
  searchParams: Record<string, string | string[] | undefined>,
  tree: Tree,
): { selection: Selection; config: ListConfig; params: ListParams; open: OpenRef | null } {
  const rawCat = first(searchParams.cat);
  const rawSec = Number(first(searchParams.sec));

  let cat: CategorySelection = null;
  let sec: number | null = null;
  const sector = Number.isInteger(rawSec) ? tree.categories.flatMap((c) => c.sectors).find((s) => s.id === rawSec) : undefined;
  if (sector) {
    cat = sector.categoryId;
    sec = sector.id;
  } else if (rawCat === 'none') {
    cat = 'none';
  } else {
    // An id, or a slug for links that must survive a database move (category-extras.ts).
    const byIdOrSlug = tree.categories.find((c) => String(c.id) === rawCat || c.slug === rawCat);
    if (byIdOrSlug) cat = byIdOrSlug.id;
  }

  // A link that carries a search, a filter, a page or a card means the list,
  // even where the node's default is the agent (old Personas links, cards).
  const listKeys = ['q', 'sort', 'page', 'open', ...PERSONA_LIST.filters.map((f) => f.key)];
  const rawTab = first(searchParams.tab) || (listKeys.some((key) => first(searchParams[key])) ? 'personas' : '');
  const tab = validTab(rawTab, tree, cat, sec);
  const config = tab === 'sectors' ? SECTOR_LIST : PERSONA_LIST;
  const params = parseListParams(searchParams, config);
  params.kept = keptFor({ cat, sec, tab });

  return { selection: { cat, sec, tab }, config, params, open: parseOpen(searchParams.open) };
}

/**
 * A tab is kept only where it means something: sectors above sector level and
 * not for "no category"; a category's own tabs only for one picked category
 * (no sector); the hub tabs only for the category that has the hub.
 * Anything else falls back to the bot list.
 */
function validTab(raw: string, tree: Tree, cat: CategorySelection, sec: number | null): BrowserTab {
  const picked = typeof cat === 'number' && sec === null ? tree.categories.find((c) => c.id === cat) : undefined;
  if (raw === 'personas') return 'personas';
  if (raw === 'sectors' && sec === null && cat !== 'none') return 'sectors';
  if ((CATEGORY_TABS as readonly string[]).includes(raw) && picked) return raw as BrowserTab;
  if ((HUB_TABS as readonly string[]).includes(raw) && picked && extrasFor(picked.slug).homeschoolHub) return raw as BrowserTab;
  return defaultTab(picked ? cat : null, sec);
}

/**
 * What a node opens on when the URL names no tab: a picked category opens on
 * its AI agent (owner, 2026-11-16: "the chat with the category's agent as the
 * default screen of every category"); everything else on the bot list.
 */
export function defaultTab(cat: CategorySelection, sec: number | null): BrowserTab {
  return typeof cat === 'number' && sec === null ? 'agent' : 'personas';
}

function keptFor({ cat, sec, tab }: Selection): Record<string, string> {
  const kept: Record<string, string> = {};
  if (cat !== null) kept.cat = String(cat);
  if (sec !== null) kept.sec = String(sec);
  if (tab !== defaultTab(cat, sec)) kept.tab = tab;
  return kept;
}

/** The current list with a card open (`open`), or closed (`null`). */
export function withOpen(params: ListParams, config: ListConfig, open: OpenRef | null): string {
  const href = listHref(BROWSER_PATH, params, config);
  if (!open) return href;
  return `${href}${href.includes('?') ? '&' : '?'}open=${openKey(open)}`;
}

/**
 * A link to another node of the tree, or another tab. Search and filters
 * stay (searching "maths" and then clicking through categories keeps the
 * search), but only when the list kind stays the same — a sectors filter
 * means nothing on personas. Paging restarts; a card closes.
 */
export function selectionHref(params: ListParams, config: ListConfig, current: Selection, next: Partial<Selection>): string {
  const target: Selection = { ...current, ...next };
  if (next.cat !== undefined && next.sec === undefined) target.sec = null;
  // Another category, and no tab asked for: a search or filter keeps its list;
  // a category's own tab (Audiences, Brief…) stays; otherwise the new node's
  // default — for a category, its agent.
  if (next.cat !== undefined && next.tab === undefined && isListTab(current.tab)) {
    const searching = Boolean(params.q) || Object.keys(params.filters).length > 0;
    if (!searching) target.tab = defaultTab(target.cat, target.sec);
  }
  // A category's own tabs need one picked category; the list is the fallback.
  // (Which category has the hub is checked when the URL is read.)
  if (!isListTab(target.tab) && (typeof target.cat !== 'number' || target.sec !== null)) target.tab = 'personas';
  if (target.sec !== null || target.cat === 'none') target.tab = target.tab === 'sectors' ? 'personas' : target.tab;
  const nextConfig = target.tab === 'sectors' ? SECTOR_LIST : PERSONA_LIST;
  const sameKind = nextConfig === config;
  const base: ListParams = sameKind
    ? { ...params, page: 1, kept: keptFor(target) }
    : { q: params.q, sort: nextConfig.defaultSort, page: 1, perPage: params.perPage, filters: {}, kept: keptFor(target) };
  return listHref(BROWSER_PATH, base, nextConfig);
}

/** Previous and next card within the rows on screen; none across a page boundary. */
export function neighbours<T>(rows: T[], index: number): { previous: T | null; next: T | null } {
  return { previous: index > 0 ? rows[index - 1] : null, next: index >= 0 && index < rows.length - 1 ? rows[index + 1] : null };
}

export const RISK_TONE: Record<string, 'slate' | 'amber' | 'rose' | 'brand'> = { R0: 'slate', R1: 'brand', R2: 'amber', R3: 'rose' };
export const RISK_MEANING: Record<string, string> = {
  R0: 'R0 — ordinary commercial work',
  R1: 'R1 — some potential for harm',
  R2: 'R2 — regulated or safety-relevant',
  R3: 'R3 — high risk to life or livelihood',
};
