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
      {
        key: 'variant', label: 'Design', type: 'select', columns: 2,
        options: [
          { id: 'standard', label: 'Standard', meta: 'Centred, badge, gradient accent' },
          { id: 'editorial', label: 'Editorial', meta: 'Large, quiet, side pillars' },
        ],
        help: 'Editorial is the restrained, large-type design adapted from SovereignAI — it looks its best under the Sovereign palette.',
      },
      { key: 'eyebrow', label: 'Eyebrow', type: 'text', maxLength: 60, help: 'The tiny spaced-out line above the headline. Editorial design only.' },
      { key: 'titleLead', label: 'Headline (plain part)', type: 'text', required: true, maxLength: 120, preserveWhitespace: true, help: 'The first half of the headline, in the normal text colour. A trailing space here is kept — it separates this from the accent part.' },
      { key: 'titleAccent', label: 'Headline (accent part)', type: 'text', maxLength: 120, help: 'The second half, painted in your brand colour. Leave blank for a single-colour headline.' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea', maxLength: 300 },
      { key: 'primaryLabel', label: 'Primary button', type: 'text', required: true, maxLength: 60 },
      { key: 'secondaryLabel', label: 'Secondary button', type: 'text', maxLength: 60 },
      {
        key: 'pillars', label: 'Side pillars', type: 'repeater', itemLabel: 'Pillar', max: 4,
        help: 'The stacked cards beside the headline. Editorial design only — three reads best.',
        fields: [
          { key: 'label', label: 'Label', type: 'text', maxLength: 30 },
          { key: 'title', label: 'Title', type: 'text', maxLength: 60 },
          { key: 'body', label: 'Description', type: 'textarea', maxLength: 200 },
        ],
      },
    ],
    defaultConfig: {
      variant: 'standard',
      eyebrow: 'An AI specialist for every task',
      pillars: [
        { label: 'Range', title: 'Twenty industries', body: 'Specialists mapped to real UK sectors, not generic assistants.' },
        { label: 'Control', title: 'Yours to shape', body: 'Tone, expertise and guardrails are configuration, not code.' },
        { label: 'Pricing', title: 'Pay per message', body: 'Credits are deducted as you go. No subscription.' },
      ],
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
  // ---------------------------------------------------------------------
  // Blocks added with the builder. Unlike the eight above, these render bare
  // content and let the layout wrapper supply width, padding and background —
  // which is why their default layout is the real one, not LEGACY_LAYOUT.
  // ---------------------------------------------------------------------
  {
    key: 'features_grid',
    label: 'Feature grid',
    description: 'A grid of icon + title + text, for selling points.',
    group: 'marketing',
    icon: 'star',
    repeatable: true,
    supportsColumns: true,
    defaultLayout: { width: 'wide', columns: 3, paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      {
        key: 'items', label: 'Features', type: 'repeater', itemLabel: 'Feature', min: 1, max: 12,
        help: 'Aim for a number that divides evenly into your column count, so the last row is not left ragged.',
        fields: [
          { key: 'icon', label: 'Icon', type: 'icon', help: ICON_HELP },
          { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 80 },
          { key: 'body', label: 'Description', type: 'textarea', maxLength: 240 },
        ],
      },
    ],
    defaultConfig: {
      title: 'Why teams choose us',
      items: [
        { icon: 'bolt', title: 'Fast', body: 'Replies stream as they are written.' },
        { icon: 'shield', title: 'Private', body: 'Your conversations stay yours.' },
        { icon: 'heart', title: 'Friendly', body: 'Built to be understood, not admired.' },
      ],
    },
  },
  {
    key: 'stats',
    label: 'Statistics',
    description: 'Big numbers with short labels.',
    group: 'marketing',
    icon: 'chart',
    repeatable: true,
    supportsColumns: true,
    defaultLayout: { width: 'wide', columns: 4, background: 'subtle', paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      {
        key: 'items', label: 'Figures', type: 'repeater', itemLabel: 'Figure', min: 1, max: 8,
        fields: [
          { key: 'value', label: 'Number', type: 'text', required: true, maxLength: 20, help: 'Written exactly as it should appear — "12k", "99.9%", "24/7".' },
          { key: 'label', label: 'Label', type: 'text', required: true, maxLength: 60 },
        ],
      },
    ],
    defaultConfig: {
      items: [
        { value: '20', label: 'Specialist categories' },
        { value: '100+', label: 'Personas' },
        { value: '24/7', label: 'Always available' },
      ],
    },
  },
  {
    key: 'faq',
    label: 'FAQ',
    description: 'Questions and answers in an accordion.',
    group: 'content',
    icon: 'message-square',
    repeatable: true,
    defaultLayout: { width: 'wide', paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      {
        key: 'items', label: 'Questions', type: 'repeater', itemLabel: 'Question', min: 1, max: 20,
        fields: [
          { key: 'question', label: 'Question', type: 'text', required: true, maxLength: 200 },
          { key: 'answer', label: 'Answer', type: 'markdown', required: true, maxLength: 2000 },
        ],
      },
    ],
    defaultConfig: {
      title: 'Frequently asked questions',
      items: [{ question: 'How does billing work?', answer: 'Credits are deducted per message. There is no subscription.' }],
    },
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Quotes from customers, with names and photos.',
    group: 'marketing',
    icon: 'heart',
    repeatable: true,
    supportsColumns: true,
    defaultLayout: { width: 'wide', columns: 3, paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      {
        key: 'items', label: 'Quotes', type: 'repeater', itemLabel: 'Quote', min: 1, max: 12,
        fields: [
          { key: 'quote', label: 'Quote', type: 'textarea', required: true, maxLength: 400 },
          { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 80 },
          { key: 'role', label: 'Role or company', type: 'text', maxLength: 80 },
          { key: 'avatar', label: 'Photo', type: 'image' },
        ],
      },
    ],
    defaultConfig: { title: 'What people say', items: [{ quote: 'It saved us a whole afternoon a week.', name: 'A customer', role: '' }] },
  },
  {
    key: 'logos',
    label: 'Logo wall',
    description: 'A row of customer or partner logos.',
    group: 'marketing',
    icon: 'globe',
    repeatable: true,
    defaultLayout: { width: 'wide', paddingY: 'sm' },
    fields: [
      { key: 'title', label: 'Caption', type: 'text', maxLength: 120, help: 'A short line above the logos, e.g. "Trusted by".' },
      {
        key: 'items', label: 'Logos', type: 'repeater', itemLabel: 'Logo', min: 1, max: 16,
        fields: [
          { key: 'imageUrl', label: 'Image', type: 'image', required: true },
          { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 60, help: 'Used as the image description for screen readers.' },
          { key: 'href', label: 'Link', type: 'link' },
        ],
      },
    ],
    defaultConfig: { title: 'Trusted by', items: [] },
  },
  {
    key: 'image_text',
    label: 'Image & text',
    description: 'A picture beside a heading, text and a button.',
    group: 'content',
    icon: 'sparkles',
    repeatable: true,
    defaultLayout: { width: 'wide', paddingY: 'md' },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'body', label: 'Text', type: 'markdown', maxLength: 4000 },
      { key: 'imageUrl', label: 'Image', type: 'image' },
      {
        key: 'imagePosition', label: 'Image side', type: 'select', columns: 2,
        options: [{ id: 'right', label: 'Right' }, { id: 'left', label: 'Left' }],
        help: 'On a phone the image always sits above the text, whichever side you pick.',
      },
      { key: 'ctaLabel', label: 'Button label', type: 'text', maxLength: 60 },
      { key: 'ctaHref', label: 'Button link', type: 'link' },
    ],
    defaultConfig: { heading: 'A heading', body: 'Some text beside a picture.', imagePosition: 'right' },
  },
  {
    key: 'video',
    label: 'Video',
    description: 'An embedded YouTube or Vimeo video.',
    group: 'content',
    icon: 'bolt',
    repeatable: true,
    defaultLayout: { width: 'wide', paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      { key: 'url', label: 'Video link', type: 'link', required: true, help: 'Paste the normal YouTube or Vimeo page link. Only those two are accepted — anything else renders nothing rather than a broken frame.' },
      { key: 'caption', label: 'Caption', type: 'text', maxLength: 200 },
    ],
    defaultConfig: { url: '' },
  },
  {
    key: 'spacer',
    label: 'Spacer',
    description: 'Empty space, optionally with a dividing line.',
    group: 'layout',
    icon: 'clock',
    repeatable: true,
    defaultLayout: { width: 'wide', paddingY: 'none' },
    fields: [
      {
        key: 'height', label: 'Height', type: 'select', columns: 3,
        options: [{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }],
      },
      { key: 'divider', label: 'Show a dividing line', type: 'toggle' },
    ],
    defaultConfig: { height: 'md', divider: false },
  },
  {
    key: 'showcase',
    label: 'Showcase',
    description: 'Real work your assistants have produced, curated in Admin → Showcase.',
    group: 'data',
    icon: 'sparkles',
    repeatable: true,
    dataDriven: true,
    supportsColumns: true,
    defaultLayout: { width: 'wide', columns: 4, paddingY: 'md' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text', maxLength: 120 },
      { key: 'subtitle', label: 'Sub-heading', type: 'textarea', maxLength: 300 },
      {
        key: 'limit', label: 'How many to show', type: 'number', min: 1, max: 48,
        help: 'Newest curated pieces first, up to this many. Leave blank for 12.',
      },
      {
        key: 'personaId', label: 'Only this persona', type: 'text',
        help: 'A persona id, to show only that persona\'s work. Leave blank for everyone.',
      },
    ],
    defaultConfig: { title: 'Made with Freelee', limit: 8 },
  },
  {
    key: 'columns',
    label: 'Columns',
    description: 'Puts other blocks side by side.',
    group: 'layout',
    icon: 'check',
    repeatable: true,
    container: true,
    supportsColumns: true,
    defaultLayout: { width: 'wide', columns: 2, paddingY: 'md' },
    fields: [],
    defaultConfig: {},
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

/**
 * May `childType` be placed inside the block described by `parent`?
 *
 * Nesting is capped at one level. Extracted here, as a named pure function
 * rather than a condition inside the server action, so the rule can be tested
 * directly — see `scripts/verify-block-nesting.ts`. The action calls this; the
 * UI also calls it to decide what to offer, but the action is what actually
 * enforces it, since hiding an option does not stop a crafted request.
 */
export function canNest(
  parent: { type: string; parentId: number | null } | null | undefined,
  childType: string,
): boolean {
  if (!parent) return false;

  const parentMeta = blockMeta(parent.type);
  const childMeta = blockMeta(childType);
  if (!parentMeta || !childMeta) return false;

  // Only a container can hold anything.
  if (!parentMeta.container) return false;
  // The container must itself be top level — this is the one-level cap.
  if (parent.parentId !== null) return false;
  // A container inside a container would defeat the cap.
  if (childMeta.container) return false;

  return true;
}
