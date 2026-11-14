import { z } from 'zod';
import type { CurriculumScope } from '@/db/schema';
import { KEY_STAGES, normaliseSubject, yearsFor } from './scope';
import type { SubjectsDictionary } from './subjects';

/**
 * Parsers for the two curriculum values kept in the database: a version's
 * `curriculum_scope` and the connection's `curriculum_scope_cache`.
 *
 * Apart from ./scope.ts so the persona form — a client component that needs
 * the key stages and years but parses nothing — does not ship zod to the
 * browser. Plain module all the same: scripts can import it.
 */

/**
 * A stored scope, re-checked wherever it is used rather than trusted: jsonb has
 * no shape, and a hand-edited row must degrade to "not a tutor", not to a tool
 * with no limits.
 */
const storedScopeSchema = z.object({
  keyStages: z.array(z.enum(KEY_STAGES)).min(1),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1),
  year: z.string().optional(),
});

export function readCurriculumScope(value: unknown): CurriculumScope | null {
  const parsed = storedScopeSchema.safeParse(value);
  if (!parsed.success) return null;
  const { keyStages, subjects, year } = parsed.data;
  const scope: CurriculumScope = { keyStages, subjects: subjects.map(normaliseSubject) };
  if (year && yearsFor(keyStages).includes(year)) scope.year = year;
  return scope;
}

/* ------------------------- what Fetch stores ------------------------- */

/**
 * The compact copy of `GET /v1/scope` kept in `settings` as
 * `curriculum_scope_cache` — what the persona form offers as key stages and
 * subjects. Counts only, never content: it says what this freelee key may see.
 */
const count = z.number().int().nonnegative().catch(0);

export const curriculumScopeCacheSchema = z.object({
  fetchedAt: z.string(),
  consumer: z.object({ id: z.string(), label: z.string() }).nullable().catch(null),
  keyStages: z.array(z.object({ keyStage: z.string(), documents: count, objectives: count, questions: count })),
  subjects: z.array(z.object({ subject: z.string(), documents: count, objectives: count })),
  itemTypes: z.array(z.object({ itemType: z.string(), count })).catch([]),
  commercialOnly: z.boolean().catch(false),
  limits: z
    .object({ perMinute: z.number().nullable().catch(null), perDay: z.number().nullable().catch(null) })
    .catch({ perMinute: null, perDay: null }),
});

export type CurriculumScopeCache = z.infer<typeof curriculumScopeCacheSchema>;

export const CURRICULUM_SCOPE_CACHE_KEY = 'curriculum_scope_cache';

export function readScopeCache(value: unknown): CurriculumScopeCache | null {
  const parsed = curriculumScopeCacheSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/* ---------------------- the subject dictionary (2026-11-14) ---------------------- */

/**
 * The compact copy of `GET /v1/subjects` kept as `curriculum_subjects_cache`:
 * the subjects a parent can choose (with their years and what they are part
 * of) and the other spellings that stand for them. The assignments and
 * interfaces stay on the curriculum, which applies them in every plan.
 */
const subjectOptionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  partOf: z.string().max(80).optional(),
  from: z.string().max(4).optional(),
  to: z.string().max(4).optional(),
  childSelectable: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});

export const subjectsCacheSchema = z.object({
  version: z.string(),
  hash: z.string(),
  fetchedAt: z.string(),
  options: z.array(subjectOptionSchema).min(1),
  aliases: z.record(z.string(), z.string()).catch({}),
  parts: z.record(z.string(), z.string()).catch({}),
});

export const CURRICULUM_SUBJECTS_CACHE_KEY = 'curriculum_subjects_cache';

export function readSubjectsCache(value: unknown): SubjectsDictionary | null {
  const parsed = subjectsCacheSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/* -------------------------- the exams layer (2026-11-14) -------------------------- */

/**
 * The compact copy of `GET /v1/exams` kept as `curriculum_exams_cache`: what a
 * parent can choose as a child's target exam — the exam's identity, years,
 * series, tiers or levels, home-education access and barriers. The format and
 * coverage come back in each plan pack.
 */
const examOptionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  family: z.enum(['school-check', 'entrance', 'qualification', 'graded']),
  kind: z.string().max(20),
  board: z.string().max(40).optional(),
  code: z.string().max(20).optional(),
  years: z.object({ typical: z.string().max(10), from: z.string().max(10).optional() }).optional(),
  series: z.array(z.string().max(20)).catch([]),
  tiers: z.array(z.string().max(40)).optional(),
  levels: z.array(z.object({ id: z.string().max(40), label: z.string().max(80) })).optional(),
  subjects: z.array(z.string().max(80)).catch([]),
  access: z.string().max(40),
  barriers: z.array(z.string().max(40)).catch([]),
  note: z.string().max(400).optional(),
  verified: z.boolean(),
  practice: z.array(z.object({ id: z.string().max(40), label: z.string().max(120) })).optional(),
});

export const examsCacheSchema = z.object({
  version: z.string(),
  hash: z.string(),
  fetchedAt: z.string(),
  boards: z.record(z.string(), z.string()).catch({}),
  exams: z.array(examOptionSchema).min(1),
});

export type ExamsCache = z.infer<typeof examsCacheSchema>;

export const CURRICULUM_EXAMS_CACHE_KEY = 'curriculum_exams_cache';

export function readExamsCache(value: unknown): ExamsCache | null {
  const parsed = examsCacheSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
