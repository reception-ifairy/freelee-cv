import type { CurriculumScope } from '@/db/schema';

/**
 * The vocabulary of a curriculum tutor's scope (docs/52-curriculum-tutors.md),
 * shared by the persona form (client), the save action, the chat route and the
 * connection card.
 *
 * Plain module — no `server-only`, no `@/db` at runtime — for the same reason
 * as src/lib/connections/types.ts: the persona form is a client component and
 * must not pull the database into the browser bundle. No zod either: the
 * parsers of stored values live in ./stored.ts, which the browser never needs.
 */

/**
 * The curriculum's canonical key-stage labels. Its documents also carry
 * compounds ("KS1|KS2"), "cross" and Scottish CfE levels, but those are tags on
 * documents, not something a tutor can be scoped to.
 */
export const KEY_STAGES = ['KS1', 'KS2', 'KS3', 'KS4', 'KS5'] as const;
export type KeyStage = (typeof KEY_STAGES)[number];

export function isKeyStage(value: string): value is KeyStage {
  return (KEY_STAGES as readonly string[]).includes(value);
}

/** England's school years per key stage — the labels the curriculum's objectives use (`Y4`). */
export const YEARS_BY_KEY_STAGE: Record<KeyStage, readonly string[]> = {
  KS1: ['Y1', 'Y2'],
  KS2: ['Y3', 'Y4', 'Y5', 'Y6'],
  KS3: ['Y7', 'Y8', 'Y9'],
  KS4: ['Y10', 'Y11'],
  KS5: ['Y12', 'Y13'],
};

export function keyStageOfYear(year: string): KeyStage | undefined {
  return KEY_STAGES.find((stage) => YEARS_BY_KEY_STAGE[stage].includes(year));
}

/** Years inside the given key stages, in school order. */
export function yearsFor(keyStages: readonly string[]): string[] {
  return KEY_STAGES.filter((stage) => keyStages.includes(stage)).flatMap((stage) => [...YEARS_BY_KEY_STAGE[stage]]);
}

export function yearLabel(year: string): string {
  return `Year ${year.replace(/^Y/, '')}`;
}

/**
 * The audience segment each key stage implies (src/lib/persona/audience-segments.ts).
 * A tutor saved with a scope gets these added, so the prompt's Audience section
 * describes the actual learners — ages, needs, tone — rather than nobody.
 * KS5 is not in the brief's list but has an obvious match (Post-16).
 */
export const KEY_STAGE_SEGMENT: Record<KeyStage, string> = {
  KS1: 'B2C-CYP-02',
  KS2: 'B2C-CYP-03',
  KS3: 'B2C-CYP-04',
  KS4: 'B2C-CYP-05',
  KS5: 'B2C-CYP-06',
};

/** The curriculum's own normalisation (`Catalog::normaliseSubject`): trimmed, lower-case. */
export function normaliseSubject(subject: string | null | undefined): string {
  return (subject ?? '').trim().toLowerCase();
}

/** "KS2 · mathematics, english · Year 4" — how the tool descriptions name a tutor's scope. */
export function describeScope(scope: CurriculumScope): string {
  return [
    scope.keyStages.join(', '),
    scope.subjects.join(', '),
    scope.year ? yearLabel(scope.year) : null,
  ].filter(Boolean).join(' · ');
}
