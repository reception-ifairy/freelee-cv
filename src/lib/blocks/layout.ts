/**
 * The grid/layout system every block shares.
 *
 * This lives in its own column (`page_sections.layout`) rather than inside each
 * block's `config`, and that separation is the whole point: layout is uniform
 * across every block type, so a block added a year from now gets width,
 * columns, background, spacing and responsive visibility for free without
 * touching its own config shape.
 *
 * Plain module — no 'use client', no 'server-only'. It is read by the admin
 * (client) and the renderer (server) alike. See the note on SETTINGS_SCHEMA in
 * src/lib/settings-schema.ts for what happens when that boundary is got wrong.
 */

export const BLOCK_WIDTHS = ['full', 'wide', 'narrow'] as const;
export const BLOCK_COLUMNS = [1, 2, 3, 4] as const;
export const BLOCK_BACKGROUNDS = ['none', 'subtle', 'brand', 'dark'] as const;
export const BLOCK_PADDINGS = ['none', 'sm', 'md', 'lg'] as const;
export const BLOCK_VISIBILITY = ['all', 'desktop', 'mobile'] as const;

export type BlockWidth = (typeof BLOCK_WIDTHS)[number];
export type BlockColumns = (typeof BLOCK_COLUMNS)[number];
export type BlockBackground = (typeof BLOCK_BACKGROUNDS)[number];
export type BlockPadding = (typeof BLOCK_PADDINGS)[number];
export type BlockVisibility = (typeof BLOCK_VISIBILITY)[number];

export type BlockLayout = {
  width: BlockWidth;
  columns: BlockColumns;
  background: BlockBackground;
  paddingY: BlockPadding;
  visibleOn: BlockVisibility;
};

export const DEFAULT_BLOCK_LAYOUT: BlockLayout = {
  width: 'wide',
  columns: 3,
  background: 'none',
  paddingY: 'md',
  visibleOn: 'all',
};

/** Labels for the admin pickers. Kept beside the values so a new option cannot be added without one. */
export const WIDTH_LABELS: Record<BlockWidth, string> = {
  full: 'Full bleed',
  wide: 'Standard',
  narrow: 'Narrow (reading width)',
};

export const BACKGROUND_LABELS: Record<BlockBackground, string> = {
  none: 'None',
  subtle: 'Subtle tint',
  brand: 'Brand colour',
  dark: 'Dark',
};

export const PADDING_LABELS: Record<BlockPadding, string> = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};

export const VISIBILITY_LABELS: Record<BlockVisibility, string> = {
  all: 'Everywhere',
  desktop: 'Desktop only',
  mobile: 'Mobile only',
};

/**
 * Coerce whatever is in the jsonb column into a complete, valid layout.
 *
 * Every field is validated against its allowed set rather than trusted, because
 * these values are interpolated into class names below — an unchecked value
 * would either silently produce a broken class or, worse, become an injection
 * point if the shape ever changed. Anything unrecognised falls back to the
 * default, so an old or hand-edited row renders rather than throwing.
 */
export function resolveLayout(raw: unknown): BlockLayout {
  const input = (raw ?? {}) as Partial<Record<keyof BlockLayout, unknown>>;

  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

  const columns = Number(input.columns);

  return {
    width: pick(input.width, BLOCK_WIDTHS, DEFAULT_BLOCK_LAYOUT.width),
    columns: (BLOCK_COLUMNS as readonly number[]).includes(columns)
      ? (columns as BlockColumns)
      : DEFAULT_BLOCK_LAYOUT.columns,
    background: pick(input.background, BLOCK_BACKGROUNDS, DEFAULT_BLOCK_LAYOUT.background),
    paddingY: pick(input.paddingY, BLOCK_PADDINGS, DEFAULT_BLOCK_LAYOUT.paddingY),
    visibleOn: pick(input.visibleOn, BLOCK_VISIBILITY, DEFAULT_BLOCK_LAYOUT.visibleOn),
  };
}

/**
 * Class names are looked up from these maps, never built by string
 * concatenation — Tailwind only ships classes it can see literally in the
 * source, so an interpolated `py-${size}` would compile but produce no CSS.
 */
const WIDTH_CLASS: Record<BlockWidth, string> = {
  full: 'w-full',
  wide: 'container-app',
  narrow: 'container-app max-w-3xl',
};

const BACKGROUND_CLASS: Record<BlockBackground, string> = {
  none: '',
  subtle: 'bg-slate-50 dark:bg-slate-900/40',
  brand: 'bg-brand-600 text-white',
  dark: 'bg-slate-900 text-slate-100 dark:bg-black',
};

const PADDING_CLASS: Record<BlockPadding, string> = {
  none: '',
  sm: 'py-6',
  md: 'py-14',
  lg: 'py-24',
};

const VISIBILITY_CLASS: Record<BlockVisibility, string> = {
  all: '',
  desktop: 'hidden md:block',
  mobile: 'block md:hidden',
};

export const COLUMNS_CLASS: Record<BlockColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/** Classes for the outer band — background, vertical padding, responsive visibility. */
export function outerClasses(layout: BlockLayout): string {
  return [BACKGROUND_CLASS[layout.background], PADDING_CLASS[layout.paddingY], VISIBILITY_CLASS[layout.visibleOn]]
    .filter(Boolean)
    .join(' ');
}

/** Classes for the inner container — how wide the content runs. */
export function innerClasses(layout: BlockLayout): string {
  return WIDTH_CLASS[layout.width];
}
