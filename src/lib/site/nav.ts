/**
 * Icons are **string keys, not components**.
 *
 * This module is imported by `header.tsx`, a Server Component, and handed to
 * client components. A Lucide icon is a function, and functions cannot cross
 * the RSC boundary — passing one throws "Functions cannot be passed directly to
 * Client Components". `NavIcon` resolves the key on the client side, the same
 * way `BlockIcon` already does for admin-authored block icons.
 */
export type NavIconKey =
  | 'sparkles' | 'compass' | 'layers' | 'book' | 'lifebuoy' | 'news' | 'card'
  | 'store' | 'message' | 'users' | 'bot' | 'rocket' | 'zap' | 'shield'
  | 'blocks' | 'graduation';

/**
 * The public site's navigation, split by who is looking.
 *
 * Until now every header item was `visibleTo: 'all'`, so a first-time visitor
 * and a paying customer saw an identical menu. Those are two different jobs:
 *
 *  - A **visitor** is deciding whether this product is for them. They need the
 *    catalogue, the proof, and the price. Research on marketplace UX is
 *    consistent that the catalogue is a *logged-out* experience — show
 *    everything, and ask for a sign-in only when someone wants to go deeper.
 *  - A **member** has already decided. They need their own work: their
 *    conversations, their crews, their balance. Marketing copy in that nav is
 *    just distance between them and the thing they came back for.
 *
 * This module is the shape; `menu_items` in the database stays the place to add
 * custom links, and the header merges them in. Two nav systems would drift, so
 * the DB rows render through the same components as these.
 */

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  icon?: NavIconKey;
  /** Renders a small tag — "New", "Beta", "Soon". */
  tag?: string;
  /** Nothing to link to yet. Rendered in place but not clickable, so the shape of the product is visible before every part of it is built. */
  placeholder?: boolean;
};

export type NavColumn = {
  heading: string;
  links: NavLink[];
};

export type NavSection =
  | { kind: 'link'; label: string; href: string }
  | {
      kind: 'mega';
      label: string;
      /** Columns of links. Two or three read well; four starts to need a second row. */
      columns: NavColumn[];
      /** The panel's right-hand rail — a single promoted destination. */
      feature?: {
        eyebrow: string;
        title: string;
        body: string;
        href: string;
        cta: string;
        icon: NavIconKey;
      };
    };

/* ------------------------------ Visitors ------------------------------- */

export const VISITOR_NAV: NavSection[] = [
  {
    kind: 'mega',
    label: 'Personas',
    columns: [
      {
        heading: 'Browse',
        links: [
          { label: 'All personas', href: '/personas', description: 'The full catalogue, filterable by sector', icon: 'compass' },
          { label: 'By category', href: '/personas', description: 'Marketing, writing, finance, and more', icon: 'layers' },
          // `/marketplace` is auth-gated — it 307s to /login. Advertising it to
          // a visitor as something to browse spends a click and a page load to
          // arrive at a sign-in form, which is the opposite of what a
          // catalogue nav is for. Named with the sign-in requirement stated,
          // rather than hidden or linked dishonestly.
          { label: 'Vendor marketplace', href: '/register', description: 'Personas from outside vendors — sign in to install', icon: 'store' },
        ],
      },
      {
        heading: 'Understand',
        links: [
          { label: 'The Bionic Core', href: '/bionic', description: 'The architecture behind every persona', icon: 'bot' },
          { label: 'How personas work', href: '/bionic#systems', description: 'Trust, cognition and voice as one system', icon: 'blocks' },
          // Named, not built. Showing the shape of the product before every
          // part of it exists is better than a nav that grows a link at a time
          // and never reads as a whole.
          { label: 'Build your own', href: '#', description: 'Design a persona from scratch', icon: 'rocket', tag: 'Soon', placeholder: true },
        ],
      },
    ],
    feature: {
      eyebrow: 'Start here',
      title: 'Meet a specialist',
      body: 'Every persona has its own expertise, personality and guardrails. Try one free — no card, no signup.',
      href: '/personas',
      cta: 'Browse personas',
      icon: 'sparkles',
    },
  },
  {
    kind: 'mega',
    label: 'Platform',
    columns: [
      {
        heading: 'Capabilities',
        links: [
          { label: 'Conversations', href: '/bionic#systems', description: 'Streaming chat with tools and memory', icon: 'message' },
          { label: 'Voice', href: '#', description: 'Speak and listen, in any persona', icon: 'zap', tag: 'Soon', placeholder: true },
          { label: 'Crews', href: '#', description: 'Several personas working one task', icon: 'users', tag: 'Beta', placeholder: true },
        ],
      },
      {
        heading: 'Trust',
        links: [
          { label: 'Safety and guardrails', href: '/bionic#trust', description: 'What a persona will and will not do', icon: 'shield' },
          { label: 'Pricing model', href: '/pricing', description: 'Credits, deducted per message', icon: 'card' },
        ],
      },
    ],
    feature: {
      eyebrow: 'Architecture',
      title: 'The Bionic Core',
      body: 'Trust, cognitive scaffolding and narrative craft, compiled into one organism rather than bolted together.',
      href: '/bionic',
      cta: 'Explore the core',
      icon: 'bot',
    },
  },
  { kind: 'link', label: 'Pricing', href: '/pricing' },
  {
    kind: 'mega',
    label: 'Resources',
    columns: [
      {
        heading: 'Read',
        links: [
          { label: 'Blog', href: '/blog', description: 'Notes on building with personas', icon: 'news' },
          { label: 'Guides', href: '#', description: 'Getting more out of a persona', icon: 'graduation', tag: 'Soon', placeholder: true },
          { label: 'Changelog', href: '#', description: 'What shipped, and when', icon: 'book', tag: 'Soon', placeholder: true },
        ],
      },
      {
        heading: 'Get help',
        links: [
          { label: 'Support', href: '#', description: 'Talk to a human', icon: 'lifebuoy', tag: 'Soon', placeholder: true },
        ],
      },
    ],
  },
];

/* ------------------------------- Members -------------------------------- */

/**
 * Flat, deliberately. Somebody signed in is going somewhere specific, and a
 * mega panel between them and it is friction dressed up as richness.
 *
 * Rooms and Crews are per-team modules, so the header filters them by what is
 * actually enabled rather than showing a link that 404s.
 */
export type MemberLink = NavLink & { module?: 'group-chat' | 'crews' };

export const MEMBER_NAV: MemberLink[] = [
  { label: 'Chats', href: '/chat', icon: 'message' },
  { label: 'Personas', href: '/personas', icon: 'sparkles' },
  { label: 'Rooms', href: '/rooms', icon: 'users', module: 'group-chat' },
  { label: 'Crews', href: '/crews', icon: 'bot', module: 'crews' },
];
