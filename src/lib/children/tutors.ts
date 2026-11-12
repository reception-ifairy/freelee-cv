import 'server-only';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { personas, personaVersions } from '@/db/schema';
import { readCurriculumScope } from '@/lib/curriculum/stored';
import { keyStageOfYear } from '@/lib/curriculum/scope';

export type LessonTutor = { id: number; slug: string; name: string; tagline: string | null; avatar: string | null; accentColor: string; subjects: string[]; active: boolean };

/**
 * Tutors a child may have a lesson with (docs/54): personas whose current
 * version has a curriculum scope covering the child's key stage. Inactive
 * personas — the Baseline Tutor used for measurement (docs/53) — only for a
 * platform admin, so the owner can test a lesson without listing it.
 */
export async function lessonTutorsFor(year: string, isAdmin: boolean): Promise<LessonTutor[]> {
  const keyStage = keyStageOfYear(year);
  const rows = await db
    .select({
      id: personas.id, slug: personas.slug, name: personas.name, tagline: personas.tagline, avatar: personas.avatar,
      accentColor: personas.accentColor, isActive: personas.isActive, scope: personaVersions.curriculumScope,
    })
    .from(personas)
    .innerJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
    .where(isNotNull(personaVersions.curriculumScope))
    .orderBy(personas.name);
  return rows.flatMap((r) => {
    const scope = readCurriculumScope(r.scope);
    if (!scope || !keyStage || !scope.keyStages.includes(keyStage)) return [];
    if (!r.isActive && !isAdmin) return [];
    return [{ id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, avatar: r.avatar, accentColor: r.accentColor, subjects: scope.subjects, active: r.isActive }];
  });
}
