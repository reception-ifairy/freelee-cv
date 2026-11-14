/**
 * The taxonomy browser's state and tree (owner, 2026-11-14: "instead of the
 * card view, a system that makes browsing clear, with the card opening on
 * demand"). Plain module — no database, no `server-only` — so the server page,
 * the client tree and `scripts/verify-taxonomy-browser.ts` share it.
 *
 * All state is in the URL, read by the server:
 *
 *   /admin/taxonomy?pillar=business&cat=34&sec=42&tab=sectors&q=…&status=live&sort=…&page=2&open=persona-123
 *
 * - `pillar` — one of the six markets (src/lib/taxonomy/pillars.ts): only its
 *   bots, and only the categories that serve it;
 * - `cat` — a category id, or `none` for personas filed under no category;
 * - `sec` — a sector id (its category is implied, and corrected if `cat` disagrees);
 * - `tab` — `personas` (default) or `sectors`, the latter only above sector level;
 * - `q`, filters, `sort`, `page`, `per` — the list (src/lib/admin/list-query.ts);
 * - `open` — the card in the sheet: `persona-123` or `sector-42`.
 */
import { listHref, parseListParams, type ListConfig, type ListParams } from '@/lib/admin/list-query';
import { isPillarId, type PillarId } from './pillars';

export const BROWSER_PATH = '/admin/taxonomy';

export type BrowserTab = 'personas' | 'sectors';
export type CategorySelection = number | 'none' | null;
export type Selection = { pillar: PillarId | null; cat: CategorySelection; sec: number | null; tab: BrowserTab };
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

const KEEP = ['pillar', 'cat', 'sec', 'tab'];

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
  const rawPillar = first(searchParams.pillar);
  const pillar = isPillarId(rawPillar) ? rawPillar : null;
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
  } else if (tree.categories.some((c) => String(c.id) === rawCat)) {
    cat = Number(rawCat);
  }

  // Sectors of a sector make no sense; neither do the sectors of "no category".
  const tab: BrowserTab = first(searchParams.tab) === 'sectors' && sec === null && cat !== 'none' ? 'sectors' : 'personas';
  const config = tab === 'sectors' ? SECTOR_LIST : PERSONA_LIST;
  const params = parseListParams(searchParams, config);
  params.kept = keptFor({ pillar, cat, sec, tab });

  return { selection: { pillar, cat, sec, tab }, config, params, open: parseOpen(searchParams.open) };
}

function keptFor({ pillar, cat, sec, tab }: Selection): Record<string, string> {
  const kept: Record<string, string> = {};
  if (pillar !== null) kept.pillar = pillar;
  if (cat !== null) kept.cat = String(cat);
  if (sec !== null) kept.sec = String(sec);
  if (tab === 'sectors') kept.tab = 'sectors';
  return kept;
}

/** The current list with a card open (`open`), or closed (`null`). */
export function withOpen(params: ListParams, config: ListConfig, open: OpenRef | null): string {
  const href = listHref(BROWSER_PATH, params, config);
  if (!open) return href;
  return `${href}${href.includes('?') ? '&' : '?'}open=${openKey(open)}`;
}

/**
 * A link to another node of the tree, another market, or another tab. Search and filters
 * stay (searching "maths" and then clicking through categories keeps the
 * search), but only when the list kind stays the same — a sectors filter
 * means nothing on personas. Paging restarts; a card closes.
 */
export function selectionHref(params: ListParams, config: ListConfig, current: Selection, next: Partial<Selection>): string {
  const target: Selection = { ...current, ...next };
  // Another market starts from its top: the picked category may not serve it.
  if (next.pillar !== undefined && next.cat === undefined) target.cat = null;
  if ((next.cat !== undefined || next.pillar !== undefined) && next.sec === undefined) target.sec = null;
  if (target.sec !== null || target.cat === 'none') target.tab = 'personas';
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
