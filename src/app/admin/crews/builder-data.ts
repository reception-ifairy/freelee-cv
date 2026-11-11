import 'server-only';
import { asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { personas, projects, sectors } from '@/db/schema';
import type { BuilderPersona } from '@/components/admin/team-builder';

/**
 * What the team builder needs to offer: the bots it can add, and the projects
 * a team can be filed under. Shared by `/admin/crews/new` and the Build tab so
 * the two cannot offer different pools.
 *
 * Active personas, plus whoever is already on the team even if they have
 * since been switched off — otherwise a deactivated member would vanish from
 * the list and the next Save would drop it without anyone choosing to.
 */
export async function loadTeamBuilderOptions(memberIds: number[]): Promise<{
  pool: BuilderPersona[];
  projects: { id: string; name: string }[];
}> {
  const visible = memberIds.length
    ? or(eq(personas.isActive, true), inArray(personas.id, memberIds))
    : eq(personas.isActive, true);

  const [rows, projectRows] = await Promise.all([
    db
      .select({
        id: personas.id,
        slug: personas.slug,
        name: personas.name,
        expertise: personas.expertise,
        accentColor: personas.accentColor,
        isActive: personas.isActive,
        currentVersionId: personas.currentVersionId,
        sectorSlug: sectors.slug,
        sectorName: sectors.name,
        // First category by position — the same one the persona card shows.
        // Qualified explicitly; see /admin/projects/page.tsx for what a bare
        // "id" resolves to inside a correlated subquery.
        categoryId: sql<number | null>`(select c.id from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categorySlug: sql<string | null>`(select c.slug from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categoryColor: sql<string | null>`(select c.color from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
        categoryName: sql<string | null>`(select c.name from persona_categories pc join categories c on c.id = pc.category_id where pc.persona_id = ${sql.raw('"personas"."id"')} order by c.position limit 1)`,
      })
      .from(personas)
      .leftJoin(sectors, eq(sectors.id, personas.sectorId))
      .where(visible)
      .orderBy(asc(personas.name)),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
  ]);

  return {
    pool: rows.map(({ isActive, currentVersionId, ...persona }) => ({
      ...persona,
      active: isActive,
      // Exactly what runPersonaTurn needs to answer: a current version.
      published: currentVersionId !== null,
    })),
    projects: projectRows,
  };
}
