/**
 * A child's profile: the fields, and for every field why it is asked, where it
 * goes and how long it is kept (owner decision 2026-11-12: "the parent decides
 * what private data to give, each field annotated"). The form shows these
 * texts next to each field; docs/54-children-data.md repeats them.
 *
 * Plain module (no server imports) so the form can render the annotations.
 *
 * Not collected, on purpose: real name, date of birth, school, address,
 * photos, location, diagnoses. The year group gives the curriculum all the age
 * it needs; adaptations are practical instructions, never a condition.
 */

import type { ExamTarget } from './exams';

export const YEARS = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11'] as const;
export type Year = (typeof YEARS)[number];

/**
 * How a lesson runs for the youngest years in a plain chat (curriculum year
 * profiles, owner's iFairy v1.0 documents, 2026-11-13): a five-year-old cannot
 * reliably read or type a reply, so Year 1 is an adult-led session and Year 2
 * is read aloud by default. Shown on the lesson pages; null from Year 3.
 */
export function deliveryNotice(year: string): string | null {
  if (year === 'Y1') return 'Year 1 is an adult-led session: please read each turn aloud and type what your child says, points to or does.';
  if (year === 'Y2') return 'Year 2 works best read aloud: a grown-up reads each turn and stays nearby.';
  return null;
}

/**
 * Subjects come from the curriculum's subject dictionary since 2026-11-14
 * (src/lib/curriculum/subjects.ts: options, years, parts such as biology inside
 * science; FALLBACK_SUBJECTS before the first Fetch). PSHE is separate: it
 * needs its own consent.
 */

export const ADAPTATIONS: { id: string; label: string; instruction: string }[] = [
  { id: 'shorter-sentences', label: 'Shorter, simpler sentences', instruction: 'Use shorter and simpler sentences than usual for this year group.' },
  { id: 'more-breaks', label: 'More breaks', instruction: 'Offer a short break or change of activity more often.' },
  { id: 'no-timed-tasks', label: 'No timed challenges', instruction: 'Never set time limits or race against the clock.' },
  { id: 'visual-examples', label: 'More picture-like examples', instruction: 'Describe examples visually (shapes, objects, diagrams in words).' },
  { id: 'read-aloud', label: 'A grown-up reads along', instruction: 'A grown-up reads your replies aloud: keep them easy to read out.' },
  { id: 'one-step', label: 'One instruction at a time', instruction: 'Give one instruction at a time and wait.' },
];

export type Pathway = { ks4Start?: 'Y9' | 'Y10'; tier?: 'foundation' | 'higher'; scienceRoute?: 'combined' | 'triple' };

export type ChildProfile = {
  pseudonym: string;
  year: Year;
  subjects: string[];
  goals?: string;
  pathway?: Pathway;
  interests: string[];
  adaptations: string[];
  /** PSHE topics in the plan — only with the parent's separate consent. */
  includePshe: boolean;
  /** Target exams (2026-11-14): the exam and the calendar sitting, kept here; the curriculum gets the school year only. */
  targets?: ExamTarget[];
};

export type FieldNote = { why: string; where: string; howLong: string };

export const FIELD_NOTES: Record<'pseudonym' | 'year' | 'subjects' | 'goals' | 'pathway' | 'interests' | 'adaptations' | 'includePshe' | 'targets', FieldNote> = {
  pseudonym: {
    why: 'So tutors can address your child. Please use a nickname, not their real name.',
    where: 'Shown to the AI tutor during lessons only.',
    howLong: 'Until you delete the profile.',
  },
  year: {
    why: 'Picks the right part of the UK curriculum and how a tutor should talk at that age.',
    where: 'The curriculum service receives only the year (e.g. "Year 5"), never who it is for.',
    howLong: 'Until you delete the profile.',
  },
  subjects: {
    why: 'Builds the learning plan: the topics, in order, for each subject.',
    where: 'The curriculum service receives the subject names only.',
    howLong: 'Until you delete the profile.',
  },
  goals: {
    why: 'Optional. What you would like to focus on (e.g. "times tables before the summer").',
    where: 'Shown to the AI tutor during lessons only. Please leave out anything personal.',
    howLong: 'Until you change it or delete the profile.',
  },
  pathway: {
    why: 'From Year 9: when GCSE starts at your child’s school, the maths/science tier and the science route. "Not sure" is fine.',
    where: 'The curriculum service receives these settings only.',
    howLong: 'Until you delete the profile.',
  },
  interests: {
    why: 'Optional. Up to five things your child likes, so examples feel familiar (e.g. "football", "dinosaurs").',
    where: 'Shown to the AI tutor during lessons only.',
    howLong: 'Until you change them or delete the profile.',
  },
  adaptations: {
    why: 'Optional. How lessons should be paced or shaped. Practical instructions only — we never ask for a diagnosis.',
    where: 'Given to the AI tutor as instructions.',
    howLong: 'Until you change them or delete the profile.',
  },
  targets: {
    why: 'Optional. Up to three exams your child is working towards (e.g. GCSE maths in June 2028, a music grade), so the plan can pace the years before and the tutor can practise the format.',
    where: 'The month stays here. The curriculum service receives only the exam and the school year it falls in, never the date.',
    howLong: 'Until you change them or delete the profile.',
  },
  includePshe: {
    why: 'Optional, off by default. Adds PSHE topics (health, feelings, friendships, money). Tutors never teach relationships and sex education.',
    where: 'Changes which topics the curriculum adds to the plan.',
    howLong: 'Until you switch it off. You can withdraw this consent at any time.',
  },
};

/** "Anything else?" — free text, used once, never kept (src/lib/children/notes.ts). */
export const NOTES_NOTE: FieldNote = {
  why: 'Optional. In your own words, anything that helps your child learn. We turn it into adaptations from the list above.',
  where: 'Sent once to the AI service (with your consent below) to choose adaptations. Never shown to a tutor.',
  howLong: 'Not kept at all: the text is deleted as soon as the adaptations are chosen. Only the ticked adaptations are saved.',
};

export const NOT_COLLECTED = ['real name', 'date of birth', 'school', 'address', 'photos', 'location', 'diagnoses or health details'];

/** Version of the consent texts shown with the form; stored with each consent row. */
export const CONSENT_TEXT_VERSION = '2026-11-12';

export const yearLabel = (y: string) => (y.startsWith('Y') ? `Year ${y.slice(1)}` : y);
export const isGcseYear = (y: string) => ['Y9', 'Y10', 'Y11'].includes(y);
