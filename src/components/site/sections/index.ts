import { HeroSection } from './hero';
import { CategoriesSection } from './categories';
import { FeaturedPersonasSection } from './featured-personas';
import { HowItWorksSection } from './how-it-works';
import { PricingSection } from './pricing';
import { BlogSection } from './blog';
import { CtaSection } from './cta';
import { CustomContentSection } from './custom-content';
import {
  DEFAULT_HERO_CONFIG, DEFAULT_CTA_CONFIG, DEFAULT_HOW_IT_WORKS_CONFIG, DEFAULT_CUSTOM_CONTENT_CONFIG,
} from './types';

/**
 * `page.tsx`'s whole render loop is `SECTION_TYPES[row.type]`. The "core"
 * types here (everything but `custom_content`) are singletons seeded once
 * by migration `0018_page_sections.sql` — see the schema comment on
 * `pageSections` for why there's no DB constraint enforcing that (no UI
 * path can create a second one, so there's nothing to constrain against).
 */
export const CORE_SECTION_TYPES = [
  'hero', 'categories', 'featured_personas', 'how_it_works', 'pricing', 'blog', 'cta',
] as const;
export type CoreSectionType = (typeof CORE_SECTION_TYPES)[number];
export type SectionType = CoreSectionType | 'custom_content';

export function isCoreSectionType(type: string): type is CoreSectionType {
  return (CORE_SECTION_TYPES as readonly string[]).includes(type);
}

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  categories: 'Categories',
  featured_personas: 'Featured personas',
  how_it_works: 'How it works',
  pricing: 'Pricing',
  blog: 'Blog',
  cta: 'Call to action',
  custom_content: 'Custom content',
};

/** Which types carry a real, admin-editable `config` — the rest are pure DB-driven display, see docs/19-frontpage-sections.md. */
export const CONFIGURABLE_SECTION_TYPES = new Set<SectionType>(['hero', 'how_it_works', 'cta', 'custom_content']);

export const SECTION_DEFAULT_CONFIG: Record<string, unknown> = {
  hero: DEFAULT_HERO_CONFIG,
  cta: DEFAULT_CTA_CONFIG,
  how_it_works: DEFAULT_HOW_IT_WORKS_CONFIG,
  custom_content: DEFAULT_CUSTOM_CONTENT_CONFIG,
};

export async function renderSection(type: string, config: unknown) {
  switch (type) {
    case 'hero':
      return HeroSection({ config: { ...DEFAULT_HERO_CONFIG, ...(config as object) } });
    case 'categories':
      return CategoriesSection();
    case 'featured_personas':
      return FeaturedPersonasSection();
    case 'how_it_works':
      return HowItWorksSection({ config: { ...DEFAULT_HOW_IT_WORKS_CONFIG, ...(config as object) } });
    case 'pricing':
      return PricingSection();
    case 'blog':
      return BlogSection();
    case 'cta':
      return CtaSection({ config: { ...DEFAULT_CTA_CONFIG, ...(config as object) } });
    case 'custom_content':
      return CustomContentSection({ config: { ...DEFAULT_CUSTOM_CONTENT_CONFIG, ...(config as object) } });
    default:
      return null; // an unrecognised type in the DB never breaks the page — same fail-open posture as knowledge sources/translations
  }
}
