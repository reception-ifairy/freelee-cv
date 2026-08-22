import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors, categoryAudienceSegments } from '@/db/schema';
import { AUDIENCE_SEGMENTS, type AudienceSegmentConfig } from '@/lib/persona/audience-segments';
import { GUARDRAILS, type GuardrailConfig } from '@/lib/persona/guardrails';
import { suggestLayoutForPersona, resolveChatLayout, type ChatLayoutKey } from '@/lib/chat/layouts';
import { suggestedToolsFor, TOOL_CATALOG } from '@/lib/tools/catalog';
import type { BriefSector, BriefAudience, CategoryBrief } from './types';

export type { BriefSector, BriefAudience, CategoryBrief };

/**
 * Everything known about a field, assembled once.
 *
 * The taxonomy was researched properly and then went nowhere: 20 categories
 * carrying UK market size, growth, regulations and industry bodies; 103 sectors
 * with hand-scored B2C/B2B/B2G suitability; 70 audience segments with their key
 * needs and preferred tone. Read at runtime: almost none of it. Each screen that
 * wanted a piece grew its own query and took the two or three columns it
 * happened to need.
 *
 * This is the single assembler. It exists as one function rather than a query
 * per screen because the brief already has more consumers than the category
 * page — the design workbench, and later the public category pages, the
 * marketplace and crew briefs — and the recurring failure in this codebase is
 * data only one screen knows how to read.
 *
 * Two renderings of the same object: `briefForScreen` is what a person sees,
 * `briefForModel` is prose a model is given. They must not drift, which is why
 * neither re-queries.
 */

/** Mean, rounded — used for the lean bars, not for any decision. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((n, v) => n + v, 0) / values.length);
}

export async function categoryBrief(categoryId: number): Promise<CategoryBrief | null> {
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) return null;

  const [sectorRows, audienceRows] = await Promise.all([
    db
      .select()
      .from(sectors)
      .where(eq(sectors.categoryId, categoryId))
      .orderBy(asc(sectors.position), asc(sectors.name)),
    db
      .select()
      .from(categoryAudienceSegments)
      .where(eq(categoryAudienceSegments.categoryId, categoryId))
      .orderBy(asc(categoryAudienceSegments.position)),
  ]);

  const briefSectors: BriefSector[] = sectorRows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    b2c: s.b2cSuitability,
    b2b: s.b2bSuitability,
    b2g: s.b2gSuitability,
    riskLevel: s.typicalRiskLevel,
    narrativeFit: s.narrativeFit,
    interactionModes: s.primaryInteractionModes,
    personaCount: 0,
  }));

  // A code with no catalogue entry is dropped rather than rendered as a stray
  // string: the table has no foreign key (the catalogue is a TypeScript file),
  // so a segment renamed in source must not leave a ghost on the screen.
  const audiences: BriefAudience[] = audienceRows.flatMap((row) => {
    const segment = AUDIENCE_SEGMENTS[row.segmentCode];
    return segment ? [{ ...segment, note: row.note }] : [];
  });

  const layoutKey = suggestLayoutForPersona({
    categorySlugs: [category.slug],
    narrativeFit: category.narrativePotential,
    audienceSegments: audiences.map((a) => a.code),
  });

  const toolKeys = suggestedToolsFor([category.slug]);

  const risk = category.defaultRiskLevel;
  const guardrails = risk
    ? Object.values(GUARDRAILS).filter((g) => g.appliesToRiskLevels.includes(risk))
    : Object.values(GUARDRAILS).filter((g) => g.isMandatory);

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    color: category.color,
    market: {
      size: category.ukMarketSize,
      growth: category.ukGrowthRate,
      regulations: category.ukKeyRegulations,
      industryBodies: category.ukIndustryBodies,
    },
    riskLevel: risk,
    narrativePotential: category.narrativePotential,
    sectors: briefSectors,
    audiences,
    audienceLean: {
      b2c: mean(briefSectors.map((s) => s.b2c)),
      b2b: mean(briefSectors.map((s) => s.b2b)),
      b2g: mean(briefSectors.map((s) => s.b2g)),
    },
    layout: { key: layoutKey, label: resolveChatLayout(layoutKey).label },
    suggestedTools: toolKeys.flatMap((key) => {
      const meta = TOOL_CATALOG.find((t) => t.key === key);
      return meta ? [{ key, label: meta.label }] : [];
    }),
    guardrails,
  };
}

export { briefForModel } from './render';
