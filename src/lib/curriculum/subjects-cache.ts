import 'server-only';
import { getSettings } from '@/lib/settings';
import { CURRICULUM_EXAMS_CACHE_KEY, CURRICULUM_SUBJECTS_CACHE_KEY, readExamsCache, readSubjectsCache, type ExamsCache } from './stored';
import type { SubjectsDictionary } from './subjects';

/** The subject dictionary from the last Fetch, or null before the first (callers then use FALLBACK_SUBJECTS). */
export async function getSubjectsDictionary(): Promise<SubjectsDictionary | null> {
  return readSubjectsCache((await getSettings()).get(CURRICULUM_SUBJECTS_CACHE_KEY));
}

/** The exams from the last Fetch, or null before the first (no target exams can be chosen then). */
export async function getExamsCache(): Promise<ExamsCache | null> {
  return readExamsCache((await getSettings()).get(CURRICULUM_EXAMS_CACHE_KEY));
}
