import 'server-only';
import type { ReactNode } from 'react';
import { HeroSection } from '@/components/site/sections/hero';
import { CategoriesSection } from '@/components/site/sections/categories';
import { FeaturedPersonasSection } from '@/components/site/sections/featured-personas';
import { HowItWorksSection } from '@/components/site/sections/how-it-works';
import { PricingSection } from '@/components/site/sections/pricing';
import { BlogSection } from '@/components/site/sections/blog';
import { CtaSection } from '@/components/site/sections/cta';
import { CustomContentSection } from '@/components/site/sections/custom-content';
import {
  FeaturesGridBlock, StatsBlock, FaqBlock, TestimonialsBlock, LogosBlock,
  ImageTextBlock, VideoBlock, SpacerBlock, ColumnsBlock,
} from '@/components/site/blocks';
import { ShowcaseGallery } from '@/components/site/blocks/showcase';
import { listShowcase } from '@/lib/showcase/queries';
import { blockMeta, withDefaults } from './catalog';
import { resolveLayout, type BlockLayout } from './layout';

/**
 * The server half of the block system. The catalog (`catalog.ts`) is a plain
 * module holding metadata both the admin and the site read; this file holds the
 * rendering, imports the database-touching section components, and is therefore
 * `server-only`.
 *
 * Keeping them apart is not ceremony — importing a server-only registry into a
 * client component has broken the build twice on this project (the AI provider
 * registry, then the tools registry). The rule that works: **constants in one
 * file, implementations in another, joined on `key`.**
 */

export type BlockRow = {
  id: number;
  type: string;
  config: unknown;
  layout: unknown;
  isVisible: boolean;
  parentId?: number | null;
};

/** The layout a block renders with: its own catalog default, overridden by whatever the admin saved. */
export function layoutFor(type: string, stored: unknown): BlockLayout {
  return resolveLayout({ ...(blockMeta(type)?.defaultLayout ?? {}), ...((stored ?? {}) as object) });
}

/**
 * Renders one block's inner content — no layout band; the wrapper supplies that.
 *
 * Returns `null` for an unrecognised type so a stale row in the database can
 * never break the page, the same fail-open posture as knowledge sources and
 * translations.
 */
export async function renderBlockContent(
  type: string,
  rawConfig: unknown,
  layout: BlockLayout,
  children?: ReactNode,
): Promise<ReactNode> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each component has its own config shape; the catalog is what keeps them in step
  const config = withDefaults(type, rawConfig) as any;

  switch (type) {
    // The eight that predate the builder. Each renders its own band.
    case 'hero':
      return HeroSection({ config });
    case 'categories':
      return CategoriesSection();
    case 'featured_personas':
      return FeaturedPersonasSection();
    case 'how_it_works':
      return HowItWorksSection({ config });
    case 'pricing':
      return PricingSection();
    case 'blog':
      return BlogSection();
    case 'cta':
      return CtaSection({ config });
    case 'custom_content':
      return CustomContentSection({ config });

    // Builder blocks. Bare content — the wrapper supplies width and padding.
    case 'features_grid':
      return FeaturesGridBlock({ config, layout });
    case 'stats':
      return StatsBlock({ config, layout });
    case 'faq':
      return FaqBlock({ config });
    case 'testimonials':
      return TestimonialsBlock({ config, layout });
    case 'logos':
      return LogosBlock({ config });
    case 'image_text':
      return ImageTextBlock({ config });
    case 'video':
      return VideoBlock({ config });
    case 'spacer':
      return SpacerBlock({ config });
    case 'columns':
      return ColumnsBlock({ layout, children });

    case 'showcase': {
      // Fetched here rather than in the component so the gallery stays a thin
      // client component and the query never reaches the browser.
      const personaId = Number(config.personaId);
      const pieces = await listShowcase({
        limit: Number(config.limit) || 12,
        personaId: Number.isInteger(personaId) && personaId > 0 ? personaId : undefined,
      });
      // Rendered as JSX, not called as a function like the blocks above it.
      // ShowcaseGallery is the first *client* block (it needs state for the
      // lightbox), and a client component can only cross the boundary as an
      // element — calling it throws "Attempted to call ShowcaseGallery() from
      // the server". That is also why this file is .tsx rather than .ts.
      return <ShowcaseGallery pieces={pieces} layout={layout} title={config.title} subtitle={config.subtitle} />;
    }

    default:
      return null;
  }
}
