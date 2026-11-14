import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, categoryAudienceSegments, personas, personaVersions } from '@/db/schema';

export type SegmentUsage = {
  categories: { id: number; name: string; note: string | null }[];
  /** Personas whose current version lists the segment — at most `limit`, live ones first. */
  personas: { id: number; name: string; isActive: boolean; reachesPrompt: boolean }[];
  totalPersonas: number;
  livePersonas: number;
  /**
   * Of those, how many never pass it to the model: their own audience type
   * differs, and since 2026-11-14 (freelee #77) the prompt names only
   * segments of the persona's own kind.
   */
  storedOnly: number;
};

/**
 * Where one audience segment is used: the categories that link it (with the
 * operator's note) and the personas that list it. For the Audiences sheet,
 * so it runs for one code at a time, only when a card is open.
 */
export async function segmentUsage(code: string, audienceType: string, limit = 12): Promise<SegmentUsage> {
  const lists = sql`${personaVersions.audienceSegments} @> ${JSON.stringify([code])}::jsonb`;
  const reaches = sql<boolean>`${personaVersions.audienceType} = ${audienceType}`;

  const [linked, rows, [totals]] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, note: categoryAudienceSegments.note })
      .from(categoryAudienceSegments)
      .innerJoin(categories, eq(categories.id, categoryAudienceSegments.categoryId))
      .where(eq(categoryAudienceSegments.segmentCode, code))
      .orderBy(asc(categories.name)),
    db
      .select({ id: personas.id, name: personas.name, isActive: personas.isActive, reachesPrompt: reaches })
      .from(personas)
      .innerJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(lists)
      .orderBy(sql`${personas.isActive} desc`, asc(personas.name))
      .limit(limit),
    db
      .select({
        total: sql<number>`count(*)::int`,
        live: sql<number>`count(*) filter (where ${personas.isActive})::int`,
        storedOnly: sql<number>`count(*) filter (where ${personaVersions.audienceType} is distinct from ${audienceType})::int`,
      })
      .from(personas)
      .innerJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(lists),
  ]);

  return {
    categories: linked,
    personas: rows,
    totalPersonas: totals?.total ?? 0,
    livePersonas: totals?.live ?? 0,
    storedOnly: totals?.storedOnly ?? 0,
  };
}
