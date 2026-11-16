import {
  LayoutGrid,
  Sparkles,
  Tags,
  Layers,
  SlidersHorizontal,
  Package,
  Receipt,
  Users,
  PenLine,
  FileText,
  Menu as MenuIcon,
  Settings,
  Palette,
  BookOpen,
  Cpu,
  RefreshCw,
  Clock,
  Store,
  Languages,
  Search,
  LayoutTemplate,
  LifeBuoy,
  Images,
  Inbox,
  FolderKanban,
  Bot,
  MessagesSquare,
  Library,
  LibraryBig,
  FlaskConical,
  Users2,
  type LucideIcon,
  Plug,
} from 'lucide-react';

/**
 * The admin sidebar, as data.
 *
 * Split out of `admin/layout.tsx` so the rendering can be a client component
 * that reads `usePathname` — the layout is a Server Component and never knew
 * which page was open, so all 23 links rendered identically and the panel
 * could not tell you where you were.
 *
 * `tone` is a real field rather than a class, because per-item colour needs to
 * survive a nav that grows: a new page inherits its group's colour for free.
 */

export type AdminNavTone = keyof typeof TONE_CLASSES;

/**
 * Fixed hues, deliberately **not** brand tokens.
 *
 * `.admin-console` re-binds `--color-brand-*` to one sky ramp, so anything
 * built on brand would render 23 identical blue icons — exactly the problem
 * this is fixing. These are also independent of the site palette, which never
 * reaches the admin anyway (custom properties resolve from the nearest
 * ancestor, and `.admin-console` is nearer than the theme composer's `:root`).
 *
 * Colour carries grouping here, not decoration: four hues you learn once beat
 * 23 you never learn at all.
 */
export const TONE_CLASSES = {
  sky: { idle: 'text-sky-400/70', active: 'text-sky-400', rail: 'bg-sky-400' },
  violet: { idle: 'text-violet-400/70', active: 'text-violet-400', rail: 'bg-violet-400' },
  emerald: { idle: 'text-emerald-400/70', active: 'text-emerald-400', rail: 'bg-emerald-400' },
  amber: { idle: 'text-amber-400/70', active: 'text-amber-400', rail: 'bg-amber-400' },
  cyan: { idle: 'text-cyan-400/70', active: 'text-cyan-400', rail: 'bg-cyan-400' },
  // Taxonomy. Lime is what is left that reads as a different colour at 16px
  // from the violet above it and the rose below it — indigo and teal both sit
  // close enough to violet and cyan to be a coin flip at icon size.
  lime: { idle: 'text-lime-400/70', active: 'text-lime-400', rail: 'bg-lime-400' },
  // Knowledge. Rose rather than another blue-green: the six tones above already
  // occupy that half of the wheel, and at 16px an indigo or a teal is
  // indistinguishable from the violet and cyan either side of it. Tone here is
  // categorical only — severity is Badge's scale, not this one.
  rose: { idle: 'text-rose-400/70', active: 'text-rose-400', rail: 'bg-rose-400' },
  slate: { idle: 'text-slate-500', active: 'text-slate-300', rail: 'bg-slate-400' },
} as const;

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Marks a hub whose children are separate top-level routes, so prefix
   * matching must not claim them. `/admin` would otherwise be "active" on
   * every single page.
   */
  exact?: boolean;
  /** A colour dot in place of the icon (the categories). */
  dot?: string;
  /** Dimmed: there, but empty (a category with no bot). */
  muted?: boolean;
  /** Shown beside the label, e.g. "16/32" live/total bots. */
  meta?: string;
  /** Current when on `/admin/taxonomy` with this `cat` (an id or slug) — the category items. */
  category?: { id: number; slug: string };
};

export type AdminNavSection = {
  /** Stable id for the fold state (cookie) — never shown. */
  id: string;
  heading: string | null;
  tone: AdminNavTone;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    id: 'overview',
    heading: null,
    tone: 'sky',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutGrid, exact: true }],
  },
  {
    id: 'catalogue',
    heading: 'Catalogue',
    tone: 'violet',
    items: [
      { href: '/admin/personas', label: 'Personas', icon: Sparkles },
      { href: '/admin/taxonomy', label: 'Taxonomy', icon: Tags },
      { href: '/admin/taxonomy/audiences', label: 'Audiences', icon: Users2 },
      { href: '/admin/taxonomy/drafts', label: 'Drafts', icon: FlaskConical },
      { href: '/admin/modifiers', label: 'Prompt modifiers', icon: SlidersHorizontal },
    ],
  },
  {
    id: 'knowledge',
    heading: 'Knowledge',
    tone: 'rose',
    items: [
      { href: '/admin/knowledgebase', label: 'Library', icon: Library },
      { href: '/admin/knowledgebase/collections', label: 'Shelves', icon: LibraryBig },
      { href: '/admin/knowledge-sources', label: 'External sources', icon: Search },
    ],
  },
  {
    id: 'teamwork',
    heading: 'Teamwork',
    tone: 'cyan',
    items: [
      { href: '/admin/crews', label: 'Bot teams', icon: Bot },
      { href: '/admin/rooms', label: 'Rooms', icon: MessagesSquare },
      { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    // What is sold (packs, plans, passes), then who bought (sales, customers), then the rest.
    id: 'commerce',
    heading: 'Commerce',
    tone: 'emerald',
    items: [
      { href: '/admin/packs', label: 'Credit packs', icon: Package },
      { href: '/admin/plans', label: 'Subscription plans', icon: RefreshCw },
      { href: '/admin/passes', label: 'Access passes', icon: Clock },
      { href: '/admin/sales', label: 'Sales', icon: Receipt },
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
      { href: '/admin/leads', label: 'Leads', icon: Inbox },
    ],
  },
  {
    // Everything a visitor sees, wording included — Translations and Branding
    // sat under System, beside keys and settings they have nothing to do with.
    id: 'site',
    heading: 'Site',
    tone: 'amber',
    items: [
      { href: '/admin/frontpage', label: 'Frontpage', icon: LayoutTemplate },
      { href: '/admin/pages', label: 'Pages', icon: FileText },
      { href: '/admin/showcase', label: 'Showcase', icon: Images },
      { href: '/admin/posts', label: 'Blog', icon: PenLine },
      { href: '/admin/menus', label: 'Menus', icon: MenuIcon },
      { href: '/admin/translations', label: 'Translations', icon: Languages },
      { href: '/admin/theme', label: 'Branding', icon: Palette },
    ],
  },
  {
    id: 'system',
    heading: 'System',
    tone: 'slate',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/connections', label: 'Connections', icon: Plug },
      { href: '/admin/handbook', label: 'Handbook', icon: LifeBuoy },
      { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
    ],
  },
];

/**
 * Groups open when no choice has been saved: where the owner works most. Every
 * other group folds to one line until opened, and the group of the page you
 * are on is always open.
 */
export const DEFAULT_OPEN_GROUPS = ['categories', 'catalogue'];

/** Cookie holding the groups the reader has open (comma-separated ids), so the server renders them that way. */
export const NAV_GROUPS_COOKIE = 'admin_nav_open';

/**
 * The categories group — the platform's pillars (owner, 2026-11-16). Built
 * from the database at request time, so it is not part of ADMIN_NAV; the
 * layout reads the categories and their live/total bots and passes them in.
 * Each item opens the category in the taxonomy browser.
 */
export const CATEGORY_GROUP_ID = 'categories';

export type NavCategory = { id: number; slug: string; name: string; color: string | null; live: number; total: number };

export function categoryNavSection(categories: readonly NavCategory[]): AdminNavSection {
  return {
    id: CATEGORY_GROUP_ID,
    heading: 'Categories',
    tone: 'lime',
    items: categories.map((c) => ({
      href: `/admin/taxonomy?cat=${c.id}`,
      label: c.name,
      icon: Tags,
      dot: c.color ?? '#6366f1',
      muted: c.total === 0,
      meta: `${c.live}/${c.total}`,
      category: { id: c.id, slug: c.slug },
    })),
  };
}

/** Whether a category item is the open one: the taxonomy browser with its `cat` (id or slug). */
export function isCategoryItemCurrent(item: AdminNavItem, pathname: string, cat: string | null): boolean {
  return Boolean(item.category) && pathname === '/admin/taxonomy' && cat !== null && (cat === String(item.category!.id) || cat === item.category!.slug);
}

/** Reads the cookie value; missing or empty means the defaults. Unknown ids are dropped. */
export function parseOpenGroups(value: string | undefined | null): string[] {
  if (value === undefined || value === null) return DEFAULT_OPEN_GROUPS;
  const known = new Set([...ADMIN_NAV.map((s) => s.id), CATEGORY_GROUP_ID]);
  return value.split(',').map((v) => v.trim()).filter((v) => known.has(v));
}

/** The group that owns a route (through its current item), if any. */
export function groupOfPath(pathname: string): string | null {
  for (const section of ADMIN_NAV) {
    if (section.items.some((item) => isNavItemCurrent(item, pathname))) return section.id;
  }
  return null;
}

/**
 * Whether a nav item owns the current route.
 *
 * Longest-prefix, so `/admin/personas/769` and `/admin/personas/convert` both
 * highlight *Personas* — a detail page is still that section. `exact` items
 * match only themselves, which is what stops the Dashboard being permanently
 * active.
 *
 * The `/` boundary check matters: without it `/admin/pages` would also match
 * a hypothetical `/admin/pagesomething`.
 */
export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Whether this item — and no better-matching one — owns the route.
 *
 * Prefix matching alone lights up two rows once one section nests inside
 * another: `/admin/knowledgebase/collections` matches both *Library* and
 * *Shelves*, and a sidebar with two current pages is a sidebar you stop
 * trusting. Longest match wins, which is the rule the breadcrumb has always
 * used — this just makes the highlight agree with it.
 *
 * `exact` is still the right tool for a hub whose children are separate
 * top-level routes (the Dashboard); this handles the opposite shape, where the
 * children live *under* the parent and one of them has its own nav entry.
 */
export function isNavItemCurrent(item: AdminNavItem, pathname: string): boolean {
  const adopted = adoptedHref(pathname);
  if (adopted) return item.href === adopted;
  if (!isNavItemActive(item, pathname)) return false;
  return findActiveNavItem(pathname)?.item.href === item.href;
}

/** The nav item with exactly this href, with its section (adopted routes resolve through it). */
export function findNavItemByHref(href: string): { section: AdminNavSection; item: AdminNavItem } | null {
  for (const section of ADMIN_NAV) {
    for (const item of section.items) if (item.href === href) return { section, item };
  }
  return null;
}

/** The item owning this route, or null. Used for the header breadcrumb. */
export function findActiveNavItem(pathname: string): { section: AdminNavSection; item: AdminNavItem } | null {
  let best: { section: AdminNavSection; item: AdminNavItem } | null = null;
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (!isNavItemActive(item, pathname)) continue;
      // Longest href wins, so a nested section beats a shorter prefix.
      if (!best || item.href.length > best.item.href.length) best = { section, item };
    }
  }
  return best;
}

/** The AI models screen redirects into Settings, so it has no nav entry but still needs a breadcrumb. */
export const ADMIN_NAV_ALIASES: Record<string, string> = {
  '/admin/ai-models': 'AI models',
  // Redirected into Taxonomy, but their [id] edit routes are still real pages.
  '/admin/categories': 'Categories',
  '/admin/sectors': 'Sectors',
  '/admin/markets': 'Markets (retired)',
};

/**
 * Routes that belong to a nav item without living under its href.
 *
 * `/admin/categories/29` is a category editor and should light up *Categories*,
 * but it shares no prefix with `/admin/taxonomy` — so until now, editing a
 * category or a sector highlighted nothing at all and the sidebar simply went
 * blank on you. Prefix matching cannot express "this route belongs over there";
 * this can.
 */
const NAV_ADOPTIONS: { prefix: string; href: string }[] = [
  { prefix: '/admin/categories', href: '/admin/taxonomy' },
  { prefix: '/admin/sectors', href: '/admin/taxonomy' },
  { prefix: '/admin/ai-models', href: '/admin/settings' },
  // Retired 2026-11-16 (the categories are the pillars); the pages only redirect into the taxonomy.
  { prefix: '/admin/markets', href: '/admin/taxonomy' },
];

export function adoptedHref(pathname: string): string | null {
  return NAV_ADOPTIONS.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`))?.href ?? null;
}
