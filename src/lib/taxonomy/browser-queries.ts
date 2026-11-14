import 'server-only';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions, sectors } from '@/db/schema';
import type { ListParams } from '@/lib/admin/list-query';
import type { CountRow, Selection, TreeCategoryInput, TreeSectorInput } from './browser';

/**
 * Read side of the taxonomy browser (src/lib/taxonomy/browser.ts holds the
 * state). Not in a `'use server'` file: every export there is an endpoint.
 */

/** The tree's skeleton: every category and sector, in catalogue order. */
export async function treeInputs(): Promise<{ categories: TreeCategoryInput[]; sectors: TreeSectorInput[] }> {
  const [categoryRows, sectorRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        color: categories.color,
        isActive: categories.isActive,
        riskLevel: categories.defaultRiskLevel,
      })
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select({
        id: sectors.id,
        categoryId: sectors.categoryId,
        name: sectors.name,
        isActive: sectors.isActive,
        riskLevel: sectors.typicalRiskLevel,
      })
      .from(sectors)
      .orderBy(asc(sectors.position), asc(sectors.name)),
  ]);
  return { categories: categoryRows, sectors: sectorRows };
}

/**
 * Every count the tree shows, in one query: per (category, sector), per
 * category and overall, live and in all. `count(distinct)` so a persona
 * filed in two categories would still count once overall (none is today).
 */
export async function treeCounts(): Promise<CountRow[]> {
  const rows = await db.execute<{ category_id: number | null; sector_id: number | null; g: number; total: number; live: number }>(sql`
    select pc.category_id, p.sector_id,
           grouping(pc.category_id, p.sector_id)::int as g,
           count(distinct p.id)::int as total,
           (count(distinct p.id) filter (where p.is_active))::int as live
    from ${personas} p
    left join ${personaCategories} pc on pc.persona_id = p.id
    group by grouping sets ((pc.category_id, p.sector_id), (pc.category_id), ())
  `);
  return [...rows].map((r) => ({
    // grouping() is a bitmask of the columns rolled up: 0 both kept, 1 sector rolled up, 3 both.
    level: r.g === 0 ? 'pair' : r.g === 1 ? 'category' : 'all',
    categoryId: r.category_id,
    sectorId: r.sector_id,
    total: r.total,
    live: r.live,
  }));
}

const inCategory = (categoryId: number) =>
  sql`exists (select 1 from ${personaCategories} pc where pc.persona_id = ${personas.id} and pc.category_id = ${categoryId})`;
const inNoCategory = sql`not exists (select 1 from ${personaCategories} pc where pc.persona_id = ${personas.id})`;

export type BrowserPersonaRow = {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  accentColor: string;
  isActive: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  messagesCount: number;
  audienceType: string | null;
  isTutor: boolean;
  aiProvider: string | null;
  model: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  sectorName: string | null;
  sectorSlug: string | null;
};

/** One page of personas under the selected node, with the toolbar's search, filters and sort. */
export async function browserPersonas(selection: Selection, params: ListParams): Promise<{ rows: BrowserPersonaRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (selection.sec !== null) conditions.push(eq(personas.sectorId, selection.sec));
  else if (selection.cat === 'none') conditions.push(inNoCategory);
  else if (selection.cat !== null) conditions.push(inCategory(selection.cat));

  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(or(ilike(personas.name, term), ilike(personas.tagline, term), ilike(personas.expertise, term), ilike(personas.slug, term))!);
  }
  if (params.filters.status === 'live') conditions.push(eq(personas.isActive, true));
  if (params.filters.status === 'draft') conditions.push(eq(personas.isActive, false));
  // Audience and tutor live on the current version (personas.audience_type is a dead column since Phase 4).
  if (params.filters.audience) conditions.push(sql`${personaVersions.audienceType}::text = ${params.filters.audience}`);
  if (params.filters.kind === 'tutor') conditions.push(sql`${personaVersions.curriculumScope} is not null`);
  if (params.filters.kind === 'other') conditions.push(isNull(personaVersions.curriculumScope));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = {
    name: [asc(personas.name)],
    'name-desc': [desc(personas.name)],
    popular: [desc(personas.messagesCount), asc(personas.name)],
    quiet: [asc(personas.messagesCount), asc(personas.name)],
    newest: [desc(personas.createdAt)],
  }[params.sort] ?? [asc(personas.name)];

  // The category is read through persona_categories (a persona has at most
  // one today; the lowest id is shown if that ever changes).
  const categoryOf = sql`(select min(pc.category_id) from ${personaCategories} pc where pc.persona_id = ${personas.id})`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: personas.id,
        name: personas.name,
        slug: personas.slug,
        tagline: personas.tagline,
        accentColor: personas.accentColor,
        isActive: personas.isActive,
        isFeatured: personas.isFeatured,
        isPremium: personas.isPremium,
        messagesCount: personas.messagesCount,
        audienceType: sql<string | null>`${personaVersions.audienceType}::text`,
        isTutor: sql<boolean>`${personaVersions.curriculumScope} is not null`,
        aiProvider: personaVersions.aiProvider,
        model: personaVersions.model,
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
        sectorName: sectors.name,
        sectorSlug: sectors.slug,
      })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .leftJoin(sectors, eq(sectors.id, personas.sectorId))
      .leftJoin(categories, eq(categories.id, categoryOf))
      .where(where)
      .orderBy(...orderBy, asc(personas.id))
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(where),
  ]);
  return { rows, total };
}

export type BrowserSectorRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  riskLevel: string | null;
  narrativeFit: string | null;
  b2c: number | null;
  b2b: number | null;
  b2g: number | null;
  categoryId: number;
  categoryName: string;
  total: number;
  live: number;
};

/** One page of sectors under the selected category (or all of them), with their persona counts. */
export async function browserSectors(selection: Selection, params: ListParams): Promise<{ rows: BrowserSectorRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (typeof selection.cat === 'number') conditions.push(eq(sectors.categoryId, selection.cat));
  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(or(ilike(sectors.name, term), ilike(sectors.code, term), ilike(sectors.description, term))!);
  }
  if (params.filters.status === 'active') conditions.push(eq(sectors.isActive, true));
  if (params.filters.status === 'off') conditions.push(eq(sectors.isActive, false));
  const where = conditions.length ? and(...conditions) : undefined;

  const total = sql<number>`(select count(*)::int from ${personas} p where p.sector_id = ${sql.raw('"sectors"."id"')})`;
  const live = sql<number>`(select count(*)::int from ${personas} p where p.is_active and p.sector_id = ${sql.raw('"sectors"."id"')})`;
  const orderBy = {
    position: [asc(categories.position), asc(sectors.position), asc(sectors.name)],
    name: [asc(sectors.name)],
    'name-desc': [desc(sectors.name)],
    personas: [desc(total), asc(sectors.name)],
    'personas-asc': [asc(total), asc(sectors.name)],
  }[params.sort] ?? [asc(sectors.position)];

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: sectors.id,
        name: sectors.name,
        code: sectors.code,
        description: sectors.description,
        isActive: sectors.isActive,
        riskLevel: sectors.typicalRiskLevel,
        narrativeFit: sectors.narrativeFit,
        b2c: sectors.b2cSuitability,
        b2b: sectors.b2bSuitability,
        b2g: sectors.b2gSuitability,
        categoryId: categories.id,
        categoryName: categories.name,
        total,
        live,
      })
      .from(sectors)
      .innerJoin(categories, eq(categories.id, sectors.categoryId))
      .where(where)
      .orderBy(...orderBy, asc(sectors.id))
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(sectors).where(where),
  ]);
  return { rows, total: count };
}

/** What a category's header shows beyond the tree: the brief's headline facts. */
export async function categoryHeader(categoryId: number) {
  const [row] = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      color: categories.color,
      isActive: categories.isActive,
      riskLevel: categories.defaultRiskLevel,
      marketSize: categories.ukMarketSize,
      growth: categories.ukGrowthRate,
      audienceCount: sql<number>`(select count(*)::int from category_audience_segments cas where cas.category_id = ${sql.raw('"categories"."id"')})`,
    })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  return row ?? null;
}

/** The persona card: everything worth knowing without opening the editor. */
export async function personaCard(id: number) {
  const [row] = await db
    .select({
      id: personas.id,
      name: personas.name,
      slug: personas.slug,
      tagline: personas.tagline,
      description: personas.description,
      expertise: personas.expertise,
      accentColor: personas.accentColor,
      isActive: personas.isActive,
      isFeatured: personas.isFeatured,
      isPremium: personas.isPremium,
      visibility: personas.visibility,
      creditsPerMessage: personas.creditsPerMessage,
      chatsCount: personas.chatsCount,
      messagesCount: personas.messagesCount,
      createdAt: personas.createdAt,
      updatedAt: personas.updatedAt,
      sectorId: personas.sectorId,
      sectorName: sectors.name,
      sectorSlug: sectors.slug,
      audienceType: sql<string | null>`${personaVersions.audienceType}::text`,
      audienceSegments: personaVersions.audienceSegments,
      curriculumScope: personaVersions.curriculumScope,
      aiProvider: personaVersions.aiProvider,
      model: personaVersions.model,
      version: personaVersions.version,
      categoryName: categories.name,
    })
    .from(personas)
    .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
    .leftJoin(sectors, eq(sectors.id, personas.sectorId))
    .leftJoin(categories, eq(categories.id, sql`(select min(pc.category_id) from ${personaCategories} pc where pc.persona_id = ${personas.id})`))
    .where(eq(personas.id, id))
    .limit(1);
  return row ?? null;
}

/** The sector card. */
export async function sectorCard(id: number) {
  const [row] = await db
    .select({
      id: sectors.id,
      name: sectors.name,
      code: sectors.code,
      slug: sectors.slug,
      description: sectors.description,
      isActive: sectors.isActive,
      riskLevel: sectors.typicalRiskLevel,
      narrativeFit: sectors.narrativeFit,
      interactionModes: sectors.primaryInteractionModes,
      b2c: sectors.b2cSuitability,
      b2b: sectors.b2bSuitability,
      b2g: sectors.b2gSuitability,
      categoryId: categories.id,
      categoryName: categories.name,
      total: sql<number>`(select count(*)::int from ${personas} p where p.sector_id = ${sql.raw('"sectors"."id"')})`,
      live: sql<number>`(select count(*)::int from ${personas} p where p.is_active and p.sector_id = ${sql.raw('"sectors"."id"')})`,
    })
    .from(sectors)
    .innerJoin(categories, eq(categories.id, sectors.categoryId))
    .where(eq(sectors.id, id))
    .limit(1);
  return row ?? null;
}
