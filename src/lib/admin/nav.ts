import {
  LayoutGrid, Sparkles, Tags, Layers, SlidersHorizontal, Package, Receipt, Users,
  PenLine, FileText, Menu as MenuIcon, Settings, Palette, BookOpen, Cpu,
  RefreshCw, Clock, Store, Languages, Search, LayoutTemplate, LifeBuoy, Images, Inbox,
  FolderKanban, Bot, MessagesSquare, Library, LibraryBig,
  type LucideIcon,
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
};

export type AdminNavSection = {
  heading: string | null;
  tone: AdminNavTone;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    heading: null,
    tone: 'sky',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutGrid, exact: true }],
  },
  {
    heading: 'AI',
    tone: 'violet',
    items: [
      { href: '/admin/personas', label: 'Personas', icon: Sparkles },
      // One entry, not two. Sectors only mean something inside a category,
      // and while nothing read them a separate tab could only be filled in.
      { href: '/admin/taxonomy', label: 'Taxonomy', icon: Tags },
      { href: '/admin/modifiers', label: 'Prompt modifiers', icon: SlidersHorizontal },
    ],
  },
  {
    // Its own section rather than two entries inside AI, because "what the
    // bots know" is a body of work in its own right — books to file, shelves
    // to curate, sources to wire up — and it grows independently of how
    // personas are configured. Sits directly after AI: a persona is nothing
    // without a model, and not much without something to read.
    heading: 'Knowledge',
    tone: 'rose',
    items: [
      { href: '/admin/knowledgebase', label: 'Library', icon: Library },
      { href: '/admin/knowledgebase/collections', label: 'Shelves', icon: LibraryBig },
      // Remote search APIs a persona can cite from — the same `## Grounding`
      // prompt section as the library, a completely different mechanism.
      { href: '/admin/knowledge-sources', label: 'External sources', icon: Search },
    ],
  },
  {
    // Sits after AI rather than in System: a bot team is personas working
    // together, so it belongs beside personas. Named "Teamwork" because
    // `teams` already means *tenant* everywhere in this schema and a nav item
    // called "Teams" would collide with the most load-bearing noun in the app.
    heading: 'Teamwork',
    tone: 'cyan',
    items: [
      { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
      { href: '/admin/crews', label: 'Bot teams', icon: Bot },
      { href: '/admin/rooms', label: 'Rooms', icon: MessagesSquare },
    ],
  },
  {
    heading: 'Commerce',
    tone: 'emerald',
    items: [
      { href: '/admin/packs', label: 'Credit packs', icon: Package },
      { href: '/admin/plans', label: 'Subscription plans', icon: RefreshCw },
      { href: '/admin/passes', label: 'Access passes', icon: Clock },
      { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
      { href: '/admin/sales', label: 'Sales', icon: Receipt },
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/leads', label: 'Leads', icon: Inbox },
    ],
  },
  {
    heading: 'Content',
    tone: 'amber',
    items: [
      { href: '/admin/frontpage', label: 'Frontpage', icon: LayoutTemplate },
      { href: '/admin/showcase', label: 'Showcase', icon: Images },
      { href: '/admin/posts', label: 'Blog', icon: PenLine },
      { href: '/admin/pages', label: 'Pages', icon: FileText },
      { href: '/admin/menus', label: 'Menus', icon: MenuIcon },
    ],
  },
  {
    heading: 'System',
    tone: 'slate',
    items: [
      { href: '/admin/translations', label: 'Translations', icon: Languages },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/theme', label: 'Branding', icon: Palette },
      { href: '/admin/handbook', label: 'Handbook', icon: LifeBuoy },
      { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
    ],
  },
];

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
  if (!isNavItemActive(item, pathname)) return false;
  return findActiveNavItem(pathname)?.item.href === item.href;
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
};
