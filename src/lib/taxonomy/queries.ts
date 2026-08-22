import 'server-only';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors, personas, personaCategories, personaVersions } from '@/db/schema';

/**
 * Read-side queries for the taxonomy section.
 *
 * Deliberately NOT in `server/actions/admin-taxonomy.ts`: **every export from a
 * `'use server'` file is a callable HTTP endpoint**, so a query living there is
 * a public API whether you meant it or not.
 */

/** How many personas sit in each sector of a category. One query, not one per sector. */
export async function personaCountsBySector(categoryId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ sectorId: personas.sectorId, count: sql<number>`count(*)::int` })
    .from(personas)
    .innerJoin(sectors, eq(sectors.id, personas.sectorId))
    .where(eq(sectors.categoryId, categoryId))
    .groupBy(personas.sectorId);
  return new Map(rows.flatMap((r) => (r.sectorId === null ? [] : [[r.sectorId, r.count] as const])));
}

export async function categoryList() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      color: categories.color,
      isActive: categories.isActive,
      riskLevel: categories.defaultRiskLevel,
      marketSize: categories.ukMarketSize,
      /*
       * `sql.raw('"categories"."id"')`, not `${categories.id}`. Drizzle emits a
       * bare `"id"` for the FROM-table's own column inside a `sql` template, and
       * inside a correlated subquery Postgres binds that to the INNER table — so
       * the condition compares each row to its own id and is always false. Five
       * screens in this admin have been bitten by it.
       */
      sectorCount: sql<number>`(select count(*)::int from ${sectors} s where s.category_id = ${sql.raw('"categories"."id"')})`,
      personaCount: sql<number>`(select count(*)::int from ${personaCategories} pc where pc.category_id = ${sql.raw('"categories"."id"')})`,
      audienceCount: sql<number>`(select count(*)::int from category_audience_segments cas where cas.category_id = ${sql.raw('"categories"."id"')})`,
    })
    .from(categories)
    .orderBy(asc(categories.position));
}

/** Prototypes: personas created in a workbench and not yet live. */
export async function listPrototypes() {
  return db
    .select({
      id: personas.id,
      name: personas.name,
      slug: personas.slug,
      expertise: personas.expertise,
      accentColor: personas.accentColor,
      createdAt: personas.createdAt,
      isActive: personas.isActive,
      sectorName: sectors.name,
      categoryId: sql<number | null>`(
        select pc.category_id from ${personaCategories} pc
        where pc.persona_id = ${sql.raw('"personas"."id"')} limit 1
      )`,
      categoryName: sql<string | null>`(
        select c.name from ${personaCategories} pc
        join ${categories} c on c.id = pc.category_id
        where pc.persona_id = ${sql.raw('"personas"."id"')}
        order by c.position limit 1
      )`,
      hasDraft: sql<boolean>`${personas.draftVersionId} is not null`,
    })
    .from(personas)
    .leftJoin(sectors, eq(sectors.id, personas.sectorId))
    .where(eq(personas.isActive, false))
    .orderBy(sql`${personas.createdAt} desc`);
}

/** Sector options for a picker, grouped by category. */
export async function sectorOptions() {
  return db
    .select({
      id: sectors.id,
      name: sectors.name,
      categoryId: sectors.categoryId,
      categoryName: categories.name,
    })
    .from(sectors)
    .innerJoin(categories, eq(categories.id, sectors.categoryId))
    .where(eq(sectors.isActive, true))
    .orderBy(asc(categories.position), asc(sectors.position), asc(sectors.name));
}

export async function personaVersionSummary(personaIds: number[]) {
  if (personaIds.length === 0) return new Map<number, string>();
  const rows = await db
    .select({ personaId: personaVersions.personaId, status: personaVersions.status })
    .from(personaVersions)
    .where(inArray(personaVersions.personaId, personaIds));
  return new Map(rows.map((r) => [r.personaId, r.status]));
}
