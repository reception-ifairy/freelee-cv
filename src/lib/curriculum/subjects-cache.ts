import 'server-only';
import { getSettings } from '@/lib/settings';
import { CURRICULUM_SUBJECTS_CACHE_KEY, readSubjectsCache } from './stored';
import type { SubjectsDictionary } from './subjects';

/** The subject dictionary from the last Fetch, or null before the first (callers then use FALLBACK_SUBJECTS). */
export async function getSubjectsDictionary(): Promise<SubjectsDictionary | null> {
  return readSubjectsCache((await getSettings()).get(CURRICULUM_SUBJECTS_CACHE_KEY));
}
