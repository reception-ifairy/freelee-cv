/**
 * Which subjects, at which key stages, a tutor can teach — the homeschool
 * hub's coverage grid (owner, 2026-11-14: "homeschooling is starting to look
 * like a maze"; the plan: one place that shows tutors against the curriculum).
 *
 * Plain module — no database — so `scripts/verify-tutor-coverage.ts` checks it
 * directly. The matching is the platform's own, not a second opinion:
 * - key stage: the tutor's scope lists it (as `lessonTutorsFor` filters);
 * - subject: `sameFamily` — the same subject, or parts of one whole, so a
 *   science tutor covers the child who chose biology (as the learner section
 *   of the prompt matches).
 * A cell is "offered" when the subject is taught in any year of that key
 * stage (the dictionary's `from`/`to`); cells outside are not gaps.
 */
import { YEARS_BY_KEY_STAGE, type KeyStage } from './scope';
import { offeredIn, sameFamily, subjectOptions, type SubjectOption, type SubjectsDictionary } from './subjects';

/** The key stages a child profile can be in (Year 1–11). KS5 is not offered to children here. */
export const CHILD_KEY_STAGES = ['KS1', 'KS2', 'KS3', 'KS4'] as const satisfies readonly KeyStage[];

export type CoverageTutor = { id: number; name: string; isActive: boolean; keyStages: readonly string[]; subjects: readonly string[] };
export type CoverageCell = { keyStage: KeyStage; offered: boolean; live: number; total: number; tutorIds: number[] };
export type CoverageRow = { option: SubjectOption; cells: CoverageCell[] };
export type Coverage = {
  rows: CoverageRow[];
  /** Subject × key stage pairs a parent can choose. */
  offered: number;
  /** Of those, how many a live tutor teaches. */
  coveredLive: number;
  /** …and how many any tutor teaches, live or not. */
  coveredAny: number;
};

export function offeredInKeyStage(option: SubjectOption, keyStage: KeyStage): boolean {
  return YEARS_BY_KEY_STAGE[keyStage].some((year) => offeredIn(option, year));
}

export function tutorTeaches(tutor: CoverageTutor, subject: string, keyStage: KeyStage, dict?: SubjectsDictionary | null): boolean {
  return tutor.keyStages.includes(keyStage) && tutor.subjects.some((s) => sameFamily(s, subject, dict));
}

/**
 * The grid: one row per subject a parent can choose (selectable, not a
 * consent-only subject such as PSHE), in dictionary order, one cell per key
 * stage.
 */
export function coverageGrid(tutors: readonly CoverageTutor[], dict?: SubjectsDictionary | null): Coverage {
  const options = subjectOptions(dict).filter((o) => o.childSelectable !== false && !o.sensitive);
  const rows = options.map((option) => ({
    option,
    cells: CHILD_KEY_STAGES.map((keyStage) => {
      const offered = offeredInKeyStage(option, keyStage);
      const teaching = offered ? tutors.filter((t) => tutorTeaches(t, option.id, keyStage, dict)) : [];
      return {
        keyStage,
        offered,
        live: teaching.filter((t) => t.isActive).length,
        total: teaching.length,
        tutorIds: teaching.map((t) => t.id),
      };
    }),
  }));
  const cells = rows.flatMap((r) => r.cells).filter((c) => c.offered);
  return {
    rows,
    offered: cells.length,
    coveredLive: cells.filter((c) => c.live > 0).length,
    coveredAny: cells.filter((c) => c.total > 0).length,
  };
}
