import type { BlockLayout } from './layout';

/**
 * The block catalog — what block types exist, and what each one lets an admin
 * edit. **Data, not components.**
 *
 * Plain module: no 'use client', no 'server-only'. The admin builder (client)
 * and the renderer (server) both read it. `src/lib/settings-schema.ts` records
 * what happens when this boundary is got wrong — defining a shared schema
 * inside a 'use client' file made the RSC bundler strip its value on the
 * server, crashing the page with "SETTINGS_SCHEMA[k] is not iterable". The
 * same mistake in the opposite direction (importing 'server-only' code into a
 * client component) has broken the build twice on this project.
 *
 * **Adding a block type is two edits**: an entry here, and a render function in
 * `registry.ts`. No admin form, no new route, no migration — the field schema
 * below drives the whole editing UI, exactly as SETTINGS_SCHEMA drives
 * /admin/settings.
 */

/** Curated icon set. A fixed small set resolved to real components in `block-icons.tsx` — the same trade-off as branding fonts and knowledge-source dot-paths, rather than accepting an arbitrary icon name that could 404 at render time. */
export const BLOCK_ICON_KEYS = [
  'users', 'message-square', 'bolt', 'sparkles', 'shield', 'heart',
  'star', 'check', 'clock', 'globe', 'lock', 'rocket',
  'chart', 'gift', 'phone', 'mail',
] as const;
export type BlockIconKey = (typeof BLOCK_ICON_KEYS)[number];

export function isBlockIconKey(value: unknown): value is BlockIconKey {
  return typeof value === 'string' && (BLOCK_ICON_KEYS as readonly string[]).includes(value);
}

export type SelectOption = { id: string; label: string; meta?: string };

type FieldBase = {
  key: string;
  label: string;
  help?: string;
  /** Rejected as empty when blank. Defaults to false — most block copy is optional. */
  required?: boolean;
  maxLength?: number;
  /**
   * Skip trimming. Load-bearing for `hero.titleLead`, which is rendered back to
   * back with `titleAccent` and whose trailing space is intentional.
   */
  preserveWhitespace?: boolean;
};

/** Fields allowed inside a repeater. Repeaters cannot nest — one level is enough for steps, FAQs and testimonials, and more would make the editor unusable. */
export type LeafBlockField =
  | (FieldBase & { type: 'text' | 'textarea' | 'markdown' | 'image' | 'link'; placeholder?: string })
  | (FieldBase & { type: 'number'; min?: number; max?: number })
  | (FieldBase & { type: 'toggle' })
  | (FieldBase & { type: 'select'; options: SelectOption[]; columns?: 2 | 3 | 4 })
  | (FieldBase & { type: 'icon' });

export type BlockField =
  | LeafBlockField
  | (FieldBase & { type: 'repeater'; itemLabel: string; min?: number; max?: number; fields: LeafBlockField[] });

export type BlockMeta = {
  key: string;
  label: string;
  description: string;
  /** Groups the "add a block" picker. */
  group: 'layout' | 'content' | 'marketing' | 'data';
  icon: BlockIconKey;
  /** Can a page hold more than one? The seven original core sections cannot. */
  repeatable: boolean;
  /** Holds child blocks. Capped at one level — a container cannot contain a container. */
  container?: boolean;
  /** Pulls its content from the database; nothing to edit but layout. */
  dataDriven?: boolean;
  /** Whether the `columns` layout control does anything for this block. */
  supportsColumns?: boolean;
  fields: BlockField[];
  defaultConfig: Record<string, unknown>;
  defaultLayout?: Partial<BlockLayout>;
};

/**
 * The seven original sections plus `custom_content` render their own
 * `<section className="container-app py-N">` band, with asymmetric spacing
 * (`pb-24`, `pb-6`, `py-16`…) that predates this system. Giving them a no-op
 * default layout means the wrapper adds nothing and the page renders byte for
 * byte as it did before — while still leaving every layout control available
 * to an admin who wants to put a background band behind one.
 */
const LEGACY_LAYOUT: Partial<BlockLayout> = { width: 'full', background: 'none', paddingY: 'none' };

const ICON_HELP = 'Shown above the title. Pick from the curated set so it always renders.';

export const BLOCK_CATALOG: BlockMeta[] = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'The headline band at the top of the page.',
    group: 'marketing',
    icon: 'sparkles',
    repeatable: false,
    defaultLayout: LEGACY_LAYOUT,
    fields: [
      { key: 'titleLead', label: 'Headline (plain part)', type: 'text', required: true, maxLength: 120, preserveWhitespace: true, help: 'The first half of the headline, in the normal text colour. A trailing space here is kept — it separates this from the accent part.' },
      { key: 'titleAccent', label: 'Headline (accent part)', type: 'text', maxLength: 120, help: 'The second half, painted in your brand colour. Leave blank for a single-colour headline.' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea', maxLength: 300 },
      { key: 'primaryLabel', label: 'Primary button', type: 'text', required: true, maxLength: 60 },
      { key: 'secondaryLabel', label: 'Secondary button', type: 'text', maxLength: 60 },
    ],
    defaultConfig: {
      titleLead: 'Your AI agency, ',
      titleAccent: 'staffed by personas',
      subtitle: 'Hire a specialist for every task.',
      primaryLabel: 'Browse personas',
      secondaryLabel: 'See pricing',
    },
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Category chips, pulled live from your categories.',
    group: 'data',
    icon: 'globe',
    repeatable: false,
    dataDriven: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [],
    defaultConfig: {},
  },
  {
    key: 'featured_personas',
    label: 'Featured personas',
    description: 'Personas you have marked as featured.',
    group: 'data',
    icon: 'users',
    repeatable: false,
    dataDriven: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [],
    defaultConfig: {},
  },
  {
    key: 'how_it_works',
    label: 'How it works',
    description: 'A numbered set of steps explaining your service.',
    group: 'marketing',
    icon: 'check',
    repeatable: false,
    supportsColumns: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [
      {
        key: 'steps',
        label: 'Steps',
        type: 'repeater',
        itemLabel: 'Step',
        min: 1,
        max: 6,
        help: 'Drag to reorder. Three steps reads best; more than four starts to feel like a manual.',
        fields: [
          { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'body', label: 'Description', type: 'textarea' },
        ],
      },
    ],
    defaultConfig: {
      steps: [
        { icon: 'users', title: 'Pick a persona', body: 'Each persona carries its own expertise and tone.' },
        { icon: 'message-square', title: 'Talk naturally', body: 'Replies stream in as they are written.' },
        { icon: 'bolt', title: 'Pay per use', body: 'Credits are deducted per message. No subscription.' },
      ],
    },
  },
  {
    key: 'pricing',
    label: 'Pricing',
    description: 'Your credit packs, pulled live.',
    group: 'data',
    icon: 'gift',
    repeatable: false,
    dataDriven: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [],
    defaultConfig: {},
  },
  {
    key: 'blog',
    label: 'Latest posts',
    description: 'Your three most recent published posts.',
    group: 'data',
    icon: 'star',
    repeatable: false,
    dataDriven: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [],
    defaultConfig: {},
  },
  {
    key: 'cta',
    label: 'Call to action',
    description: 'A closing band pushing visitors to sign up.',
    group: 'marketing',
    icon: 'rocket',
    repeatable: false,
    defaultLayout: LEGACY_LAYOUT,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120 },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea', maxLength: 300, help: 'Use {credits} and it is replaced with your signup bonus amount.' },
      { key: 'buttonLabel', label: 'Button label', type: 'text', required: true, maxLength: 60 },
    ],
    defaultConfig: {
      title: 'Start with free credits',
      subtitle: 'Create an account and get {credits} credits to try every persona — no card required.',
      buttonLabel: 'Create free account',
    },
  },
  {
    key: 'custom_content',
    label: 'Text & image',
    description: 'Free-form heading, text, optional image and button.',
    group: 'content',
    icon: 'message-square',
    repeatable: true,
    defaultLayout: LEGACY_LAYOUT,
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', required: true, maxLength: 120 },
      { key: 'body', label: 'Body', type: 'markdown', maxLength: 8000, help: 'Markdown works here — **bold**, lists, and links.' },
      { key: 'imageUrl', label: 'Image', type: 'image', help: 'Optional. With an image the block becomes two columns; without one it is centred.' },
      { key: 'ctaLabel', label: 'Button label', type: 'text', help: 'Leave blank for no button.' },
      { key: 'ctaHref', label: 'Button link', type: 'link' },
    ],
    defaultConfig: { heading: 'New section', body: 'Write something here.' },
  },
];

export function blockMeta(key: string): BlockMeta | undefined {
  return BLOCK_CATALOG.find((b) => b.key === key);
}

export function isBlockKey(key: string): boolean {
  return BLOCK_CATALOG.some((b) => b.key === key);
}

/** Types an admin may add freely. Everything else is seeded once and only reordered or hidden. */
export function repeatableBlocks(): BlockMeta[] {
  return BLOCK_CATALOG.filter((b) => b.repeatable);
}

export const BLOCK_GROUP_LABELS: Record<BlockMeta['group'], string> = {
  layout: 'Layout',
  content: 'Content',
  marketing: 'Marketing',
  data: 'Live data',
};

/** Merge stored config over the block's defaults, so a field added later is never `undefined` at render time. */
export function withDefaults(key: string, config: unknown): Record<string, unknown> {
  const meta = blockMeta(key);
  if (!meta) return (config ?? {}) as Record<string, unknown>;
  return { ...meta.defaultConfig, ...((config ?? {}) as Record<string, unknown>) };
}
