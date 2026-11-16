/**
 * What a few categories carry beyond the taxonomy itself (owner, 2026-11-16:
 * "the categories are the pillars — homeschooling goes under Education and
 * Training, business under Business and Finance").
 *
 * Keyed by slug, not id: the slug is the category's stable contract (chat
 * layouts and tool suggestions key off it too, and it never changes when a
 * category is renamed), while ids differ between a dev and the live database.
 *
 * Plain module, shared by the browser state (browser.ts), the pages and the
 * checks.
 */
export type CategoryExtras = {
  /** The public CMS page that sells what this category offers. */
  offeringSlug?: string;
  /** The homeschool hub tabs: tutors, the curriculum, families as numbers. */
  homeschoolHub?: boolean;
};

export const CATEGORY_EXTRAS: Record<string, CategoryExtras> = {
  'education-and-training': { offeringSlug: 'homeschooling', homeschoolHub: true },
  'business-and-finance': { offeringSlug: 'business' },
};

export function extrasFor(slug: string | null | undefined): CategoryExtras {
  return (slug && CATEGORY_EXTRAS[slug]) || {};
}

/** The category whose browser view holds the homeschool hub — for links that must reach it. */
export const HOMESCHOOL_CATEGORY_SLUG = 'education-and-training';
