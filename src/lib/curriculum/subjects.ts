/**
 * The curriculum's subject dictionary as freelee uses it (curriculum
 * docs/SUBJECTS_2026-11.md, owner decision 2026-11-14): one list of subjects
 * for curriculum, freelee and the Academy. Subjects may overlap — biology,
 * chemistry and physics are subjects of their own and part of science — and
 * the curriculum plans each part from its whole without counting a topic
 * twice.
 *
 * Fetch keeps a compact copy (`curriculum_subjects_cache`, ./stored.ts). Until
 * the first Fetch, or when the curriculum is too old to offer it,
 * FALLBACK_SUBJECTS — the sixteen subjects freelee offered before — stand in,
 * so nothing breaks.
 *
 * Plain module (no server imports, no zod): the child form renders the
 * options and scripts test the rules.
 */

/** England's school years, in order (children/profile.ts YEARS, repeated to keep this module free of imports). */
const YEAR_ORDER = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11'];

export type SubjectOption = {
  /** The curriculum's own name, e.g. "mathematics", "art and design", "biology". */
  id: string;
  /** Short label for a parent ("Maths", "Biology"). */
  label: string;
  /** The whole subject this one is part of (biology → science). */
  partOf?: string;
  /** The first and last school year the subject is offered in. */
  from?: string;
  to?: string;
  /** False for subjects chosen another way (PSHE has its own consent). */
  childSelectable?: boolean;
  sensitive?: boolean;
};

export type SubjectsDictionary = {
  version: string;
  hash: string;
  fetchedAt: string;
  options: SubjectOption[];
  /** Other spellings that are a subject: synonyms and courses ("maths", "combined science"). */
  aliases: Record<string, string>;
  /** Spellings that are a part of a subject ("english reading" → english): used to match tutors, never offered. */
  parts: Record<string, string>;
};

/** The subjects freelee offered before the dictionary (curriculum names, Y1–Y11 unless stated). */
export const FALLBACK_SUBJECTS: SubjectOption[] = [
  { id: 'mathematics', label: 'Maths' },
  { id: 'english', label: 'English' },
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
  { id: 'geography', label: 'Geography' },
  { id: 'computing', label: 'Computing' },
  { id: 'languages', label: 'Languages' },
  { id: 'art and design', label: 'Art & design' },
  { id: 'music', label: 'Music' },
  { id: 'design and technology', label: 'Design & technology' },
  { id: 'physical education', label: 'PE' },
  { id: 'religious education', label: 'RE', to: 'Y8' },
  { id: 'religious studies', label: 'Religious studies (GCSE)', from: 'Y9' },
  { id: 'drama', label: 'Drama (GCSE)', from: 'Y9' },
  { id: 'business', label: 'Business (GCSE)', from: 'Y9' },
  { id: 'psychology', label: 'Psychology (GCSE)', from: 'Y9' },
];

export const normaliseName = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** The options in force: the fetched dictionary's, or the fallback. */
export function subjectOptions(dict?: SubjectsDictionary | null): SubjectOption[] {
  return dict?.options?.length ? dict.options : FALLBACK_SUBJECTS;
}

/** Whether a subject is offered in a school year. */
export function offeredIn(option: SubjectOption, year: string): boolean {
  const at = YEAR_ORDER.indexOf(year);
  if (at < 0) return false;
  const from = option.from ? YEAR_ORDER.indexOf(option.from) : 0;
  const to = option.to ? YEAR_ORDER.indexOf(option.to) : YEAR_ORDER.length - 1;
  return at >= (from < 0 ? 0 : from) && at <= (to < 0 ? YEAR_ORDER.length - 1 : to);
}

/** What a parent may tick for a child in this year: selectable, not sensitive (PSHE is a consent), offered in the year. */
export function subjectsForYear(options: SubjectOption[], year: string): SubjectOption[] {
  return options.filter((o) => o.childSelectable !== false && !o.sensitive && offeredIn(o, year));
}

export function subjectLabel(id: string, options: SubjectOption[] = FALLBACK_SUBJECTS): string {
  return options.find((o) => o.id === id)?.label ?? FALLBACK_SUBJECTS.find((o) => o.id === id)?.label ?? id;
}

/** "Biology · part of Science" for a part, the label otherwise. */
export function displayLabel(option: SubjectOption, options: SubjectOption[]): string {
  return option.partOf ? `${option.label} · part of ${subjectLabel(option.partOf, options)}` : option.label;
}

/**
 * The subject a name stands for: itself, a synonym ("maths"), a course
 * ("combined science") or a part stored as a subject of its own ("english
 * reading" → english). Unknown names stay as they are.
 */
export function canonicalSubject(name: string, dict?: SubjectsDictionary | null): string {
  const n = normaliseName(name);
  if (!dict) return n;
  if (dict.options.some((o) => o.id === n)) return n;
  return dict.aliases[n] ?? dict.parts[n] ?? n;
}

/** The whole subject at the top: biology → science; a whole subject is its own root. */
export function rootSubject(id: string, options: SubjectOption[]): string {
  let current = id;
  for (let i = 0; i < 4; i++) {
    const parent = options.find((o) => o.id === current)?.partOf;
    if (!parent) return current;
    current = parent;
  }
  return current;
}

/**
 * Whether a tutor's subject and a child's subject belong together: the same
 * subject, or parts of the same whole (a science tutor teaches the child who
 * chose biology; an "english reading" tutor teaches English).
 */
export function sameFamily(a: string, b: string, dict?: SubjectsDictionary | null): boolean {
  const options = subjectOptions(dict);
  const x = canonicalSubject(a, dict);
  const y = canonicalSubject(b, dict);
  return x === y || rootSubject(x, options) === rootSubject(y, options);
}

/** Whether any option is a part of another, so the form can explain the overlap. */
export const hasParts = (options: SubjectOption[]) => options.some((o) => o.partOf);
