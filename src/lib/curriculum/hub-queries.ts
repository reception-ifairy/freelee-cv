import 'server-only';
import { asc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions, sectors } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { connectionView } from '@/lib/connections/registry';
import type { StoredTest } from '@/lib/connections/types';
import { readCurriculumScope, readExamsCache, readScopeCache, readSubjectsCache, CURRICULUM_EXAMS_CACHE_KEY, CURRICULUM_SCOPE_CACHE_KEY, CURRICULUM_SUBJECTS_CACHE_KEY } from './stored';
import type { CoverageTutor } from './coverage';

/** Read side of the homeschool hub (/admin/markets/homeschooling). */

export type HubTutor = CoverageTutor & {
  slug: string;
  tagline: string | null;
  messagesCount: number;
  sectorName: string | null;
  categoryName: string | null;
};

/** Every curriculum tutor — a persona whose current version has a curriculum scope — live ones first. */
export async function hubTutors(): Promise<HubTutor[]> {
  const rows = await db
    .select({
      id: personas.id,
      name: personas.name,
      slug: personas.slug,
      tagline: personas.tagline,
      isActive: personas.isActive,
      messagesCount: personas.messagesCount,
      scope: personaVersions.curriculumScope,
      sectorName: sectors.name,
      categoryName: categories.name,
    })
    .from(personas)
    .innerJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
    .leftJoin(sectors, eq(sectors.id, personas.sectorId))
    .leftJoin(categories, eq(categories.id, sql`(select min(pc.category_id) from ${personaCategories} pc where pc.persona_id = ${personas.id})`))
    .where(isNotNull(personaVersions.curriculumScope))
    .orderBy(sql`${personas.isActive} desc`, asc(personas.name));
  return rows.flatMap((r) => {
    const scope = readCurriculumScope(r.scope);
    if (!scope) return [];
    return [{
      id: r.id, name: r.name, slug: r.slug, tagline: r.tagline, isActive: r.isActive, messagesCount: r.messagesCount,
      sectorName: r.sectorName, categoryName: r.categoryName, keyStages: scope.keyStages, subjects: scope.subjects,
    }];
  });
}

export type CurriculumStatus = {
  configured: boolean;
  lastTest: StoredTest | null;
  subjects: { version: string; fetchedAt: string; options: number; parts: number } | null;
  exams: { version: string; fetchedAt: string; total: number; verified: number; byFamily: Record<string, number> } | null;
  scope: { fetchedAt: string; keyStages: { keyStage: string; objectives: number; questions: number }[] } | null;
};

/** What freelee holds from the curriculum: the connection's state and the three caches the last Fetch saved. */
export async function curriculumStatus(): Promise<CurriculumStatus> {
  const settings = await getSettings();
  const view = connectionView('curriculum', settings);
  const subjects = readSubjectsCache(settings.get(CURRICULUM_SUBJECTS_CACHE_KEY));
  const exams = readExamsCache(settings.get(CURRICULUM_EXAMS_CACHE_KEY));
  const scope = readScopeCache(settings.get(CURRICULUM_SCOPE_CACHE_KEY));
  return {
    configured: view.configured,
    lastTest: view.lastTest,
    subjects: subjects
      ? { version: subjects.version, fetchedAt: subjects.fetchedAt, options: subjects.options.length, parts: subjects.options.filter((o) => o.partOf).length }
      : null,
    exams: exams
      ? {
          version: exams.version,
          fetchedAt: exams.fetchedAt,
          total: exams.exams.length,
          verified: exams.exams.filter((e) => e.verified).length,
          byFamily: exams.exams.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.family]: (acc[e.family] ?? 0) + 1 }), {}),
        }
      : null,
    scope: scope
      ? { fetchedAt: scope.fetchedAt, keyStages: scope.keyStages.map((k) => ({ keyStage: k.keyStage, objectives: k.objectives, questions: k.questions })) }
      : null,
  };
}
