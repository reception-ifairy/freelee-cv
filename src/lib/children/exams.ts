/**
 * A child's target exams (owner decision 2026-11-14: "the parent picks a target
 * exam and the plan works back from it"; curriculum docs/EXAMS_2026-11.md).
 *
 * The profile keeps the calendar sitting ("2028-06"). The curriculum never gets
 * a date: freelee turns the sitting into the school year the child will be in
 * (`atYear`) and the exam series, so a plan pack depends on learning settings
 * only and does not reveal a child's cohort.
 *
 * Plain module (no server imports): the form and scripts use it.
 */

export type ExamOption = {
  id: string;
  title: string;
  family: 'school-check' | 'entrance' | 'qualification' | 'graded';
  kind: string;
  board?: string;
  code?: string;
  years?: { typical: string; from?: string };
  series: string[];
  tiers?: string[];
  levels?: { id: string; label: string }[];
  subjects: string[];
  access: string;
  barriers: string[];
  note?: string;
  verified: boolean;
  /** Practice papers the curriculum serves for this exam (e.g. KS2 grammar paper 1). */
  practice?: { id: string; label: string }[];
};

export type ExamTarget = { exam: string; sitting: string; tier?: string; level?: string };

export const MAX_TARGETS = 4;
export const FORM_TARGETS = 3;

const YEAR_ORDER = ['Reception', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11'];

export const FAMILY_LABEL: Record<ExamOption['family'], string> = {
  'school-check': 'School tests (practice at home)',
  entrance: 'Selective school entrance',
  qualification: 'Qualifications (GCSE, International GCSE, Functional Skills)',
  graded: 'Graded exams (music, drama, dance, English, arts)',
};

export const BARRIER_LABEL: Record<string, string> = {
  nea: 'coursework marked by a centre',
  portfolio: 'a portfolio marked by a centre',
  'speaking-test': 'a speaking test run by the centre',
  endorsement: 'a spoken-language endorsement assessed by the centre',
  practicals: 'required practicals the centre must confirm',
  'practical-exam': 'a practical exam or performance',
};

/** "June 2028" from "2028-06". */
export function sittingLabel(sitting: string): string {
  const [y, m] = sitting.split('-').map(Number);
  if (!y || !m) return sitting;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export const isSitting = (value: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);

/** The academic year (September to August) a month falls in, by its starting calendar year. */
function academicYear(year: number, month: number): number {
  return month >= 9 ? year : year - 1;
}

/**
 * The school year the child will be in at the sitting: the profile's year now,
 * moved on by the academic years between today and the sitting. Null after
 * Year 11 (outside what freelee plans).
 */
export function atYearFor(childYear: string, sitting: string, now = new Date()): string | null {
  if (!isSitting(sitting)) return null;
  const [y, m] = sitting.split('-').map(Number);
  const shift = academicYear(y, m) - academicYear(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const at = YEAR_ORDER.indexOf(childYear) + shift;
  if (YEAR_ORDER.indexOf(childYear) < 0 || at > YEAR_ORDER.length - 1) return null;
  return YEAR_ORDER[Math.max(0, at)];
}

/** Whole months from today to the sitting's month (0 in that month, negative after it). */
export function monthsUntil(sitting: string, now = new Date()): number {
  const [y, m] = sitting.split('-').map(Number);
  return (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth());
}

/** The exam series a sitting month belongs to. */
export function seriesForMonth(month: number): string | null {
  if (month === 5 || month === 6) return 'summer';
  if (month === 11) return 'november';
  if (month === 1) return 'january';
  if (month === 3) return 'march';
  if (month === 9 || month === 10) return 'autumn';
  return null;
}

/** Exams worth offering for a child's year: school tests and entrance up to their year, qualifications from Year 7, graded exams always. */
export function examsForYear(exams: ExamOption[], year: string): ExamOption[] {
  const at = YEAR_ORDER.indexOf(year);
  return exams.filter((e) => {
    if (e.family === 'graded') return true;
    if (e.family === 'qualification') return at >= YEAR_ORDER.indexOf('Y7');
    const typical = YEAR_ORDER.indexOf(e.years?.typical ?? 'Y11');
    return typical >= at;
  });
}

/**
 * What the plan pack receives for one target: the exam, the school year, the
 * series (only one the exam offers), tier or level (only ones it has). Null
 * when the sitting is after Year 11.
 */
export function targetRequest(target: ExamTarget, exam: ExamOption | undefined, childYear: string, now = new Date()) {
  const atYear = atYearFor(childYear, target.sitting, now);
  if (!atYear) return null;
  const series = seriesForMonth(Number(target.sitting.split('-')[1]));
  return {
    exam: target.exam,
    atYear,
    ...(exam && series && exam.series.includes(series) ? { series } : {}),
    ...(exam && target.tier && exam.tiers?.includes(target.tier) ? { tier: target.tier } : {}),
    ...(exam && target.level && exam.levels?.some((l) => l.id === target.level) ? { level: target.level } : {}),
  };
}

/** "GCSE Mathematics (AQA 8300)" — what a parent sees in the list. */
export function examLabel(exam: ExamOption, boards: Record<string, string> = {}): string {
  const board = exam.board ? boards[exam.board] ?? exam.board.toUpperCase() : null;
  return board ? `${exam.title} (${board}${exam.code ? ` ${exam.code}` : ''})` : exam.title;
}
