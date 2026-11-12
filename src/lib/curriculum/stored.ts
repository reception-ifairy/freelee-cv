import { z } from 'zod';
import type { CurriculumScope } from '@/db/schema';
import { KEY_STAGES, normaliseSubject, yearsFor } from './scope';

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
