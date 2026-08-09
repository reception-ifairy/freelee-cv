/**
 * `config` shapes for the block types that carry admin-editable content.
 *
 * The **defaults** used to live here too; they now live in
 * `src/lib/blocks/catalog.ts` beside the field declarations that drive the
 * editing UI, so a block's default value and its form control cannot drift
 * apart. They are re-exported here so existing imports keep working.
 */

import { blockMeta } from '@/lib/blocks/catalog';

export type HeroConfig = {
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export type CtaConfig = {
  title: string;
  subtitle: string;
  buttonLabel: string;
};

/** Curated set, not an arbitrary icon-name string — same "fixed small set" trade-off as branding fonts. Resolved to a real icon by `BlockIcon`. */
export type HowItWorksStep = { icon: string; title: string; body: string };
export type HowItWorksConfig = { steps: HowItWorksStep[] };

export type CustomContentConfig = {
  heading: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const defaults = <T>(key: string): T => (blockMeta(key)?.defaultConfig ?? {}) as T;

export const DEFAULT_HERO_CONFIG = defaults<HeroConfig>('hero');
export const DEFAULT_CTA_CONFIG = defaults<CtaConfig>('cta');
export const DEFAULT_HOW_IT_WORKS_CONFIG = defaults<HowItWorksConfig>('how_it_works');
export const DEFAULT_CUSTOM_CONTENT_CONFIG = defaults<CustomContentConfig>('custom_content');

/** @deprecated Use `BLOCK_ICON_KEYS` from `src/lib/blocks/catalog.ts` — kept so older imports resolve. */
export { BLOCK_ICON_KEYS as STEP_ICON_KEYS } from '@/lib/blocks/catalog';
