import 'server-only';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, categoryAudienceSegments, pages, personaCategories, personas, personaVersions } from '@/db/schema';
import { AUDIENCE_SEGMENTS } from '@/lib/persona/audience-segments';
import { PILLARS, pillarOfPersona, pillarOfSegment, pillarsOfCategory, segmentsOfPillar, type Pillar, type PillarId } from './pillars';

/**
 * Pillars are computed, not stored (src/lib/taxonomy/pillars.ts), so this
 * reads what the rules need — each bot's audience type, segments and tutor
 * scope, and each category's linked segments — and applies them in code.
 * Two light queries over every bot: fine into the thousands; past that, a
 * generated column would be the next step.
 */

export type BotPillar = {
  id: number;
  name: string;
  isActive: boolean;
  categoryId: number | null;
  audienceType: string | null;
  /** Own segments of the bot's own type — the ones that reach its prompt. */
  segments: string[];
  pillar: PillarId;
};

export async function categorySegments(): Promise<Map<number, string[]>> {
  const rows = await db
    .select({ categoryId: categoryAudienceSegments.categoryId, code: categoryAudienceSegments.segmentCode })
    .from(categoryAudienceSegments)
    .orderBy(asc(categoryAudienceSegments.categoryId), asc(categoryAudienceSegments.position), asc(categoryAudienceSegments.segmentCode));
  const map = new Map<number, string[]>();
  for (const row of rows) map.set(row.categoryId, [...(map.get(row.categoryId) ?? []), row.code]);
  return map;
}

export async function botPillars(bySegments?: Map<number, string[]>): Promise<BotPillar[]> {
  const [rows, linked] = await Promise.all([
    db
      .select({
        id: personas.id,
        name: personas.name,
        isActive: personas.isActive,
        audienceType: sql<string | null>`${personaVersions.audienceType}::text`,
        audienceSegments: personaVersions.audienceSegments,
        isTutor: sql<boolean>`${personaVersions.curriculumScope} is not null`,
        categoryId: sql<number | null>`(select min(pc.category_id) from ${personaCategories} pc where pc.persona_id = ${personas.id})`,
      })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId)),
    bySegments ?? categorySegments(),
  ]);
  return rows.map((row) => {
    const own = (row.audienceSegments ?? []).filter((code) => AUDIENCE_SEGMENTS[code]?.audienceType === row.audienceType);
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      categoryId: row.categoryId,
      audienceType: row.audienceType,
      segments: own,
      pillar: pillarOfPersona({
        audienceType: row.audienceType,
        audienceSegments: row.audienceSegments ?? [],
        isTutor: row.isTutor,
        categorySegments: row.categoryId !== null ? linked.get(row.categoryId) ?? [] : [],
      }),
    };
  });
}

/** Which pillars each category serves (its segments plus its bots'). */
export function categoryPillars(bots: BotPillar[], bySegments: Map<number, string[]>, categoryIds: number[]): Map<number, PillarId[]> {
  return new Map(
    categoryIds.map((id) => [
      id,
      pillarsOfCategory(
        bySegments.get(id) ?? [],
        bots.filter((b) => b.categoryId === id).map((b) => b.pillar),
      ),
    ]),
  );
}

export type MarketSummary = {
  pillar: Pillar;
  bots: { total: number; live: number };
  categories: { id: number; name: string; color: string | null; bots: { total: number; live: number }; linksSegments: boolean }[];
  segments: { code: string; name: string; linkedBy: number; listedBy: number }[];
  offering: { slug: string; title: string; published: boolean } | null;
};

/** Coverage per market: its bots, the fields that serve it, its audience groups and its page. Not revenue. */
export async function marketSummaries(): Promise<MarketSummary[]> {
  const bySegments = await categorySegments();
  const [bots, categoryRows, offeringRows] = await Promise.all([
    botPillars(bySegments),
    db.select({ id: categories.id, name: categories.name, color: categories.color }).from(categories).orderBy(asc(categories.position)),
    db
      .select({ slug: pages.slug, title: pages.title, published: pages.isPublished })
      .from(pages)
      .where(inArray(pages.slug, PILLARS.flatMap((p) => (p.offeringSlug ? [p.offeringSlug] : [])))),
  ]);
  const pillarsByCategory = categoryPillars(bots, bySegments, categoryRows.map((c) => c.id));
  const count = (list: BotPillar[]) => ({ total: list.length, live: list.filter((b) => b.isActive).length });

  return PILLARS.map((pillar) => {
    const mine = bots.filter((b) => b.pillar === pillar.id);
    return {
      pillar,
      bots: count(mine),
      categories: categoryRows
        .filter((c) => pillarsByCategory.get(c.id)?.includes(pillar.id))
        .map((c) => ({
          ...c,
          bots: count(mine.filter((b) => b.categoryId === c.id)),
          linksSegments: (bySegments.get(c.id) ?? []).some((code) => pillarOfSegment(code) === pillar.id),
        })),
      segments: segmentsOfPillar(pillar.id).map((code) => ({
        code,
        name: AUDIENCE_SEGMENTS[code].name,
        linkedBy: [...bySegments.values()].filter((codes) => codes.includes(code)).length,
        listedBy: bots.filter((b) => b.segments.includes(code)).length,
      })),
      offering: pillar.offeringSlug ? offeringRows.find((r) => r.slug === pillar.offeringSlug) ?? null : null,
    };
  });
}
