import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { childPlans, type ChildProfileRow } from '@/db/schema';
import { curriculumConfig, curriculumRequest } from '@/lib/curriculum/client';
import { openJson, sealJson, type ChildKey } from '@/lib/crypto/envelope';
import { ADAPTATIONS, yearLabel, type ChildProfile } from './profile';
import { sameFamily, subjectLabel as labelOf, subjectOptions, type SubjectsDictionary } from '@/lib/curriculum/subjects';
import type { YearChecks } from './turn-check';

/**
 * One learning plan per child, shared by every tutor (owner decision
 * 2026-11-12, docs/54-children-data.md).
 *
 * Built once from curriculum's POST /v1/plan-pack — which receives the year,
 * subjects and GCSE settings only, never anything about the child — and sealed
 * with the child's own key. A tutor then reads a short slice of it in its
 * prompt instead of searching the curriculum on every turn, which is what made
 * a turn cost 111 credits on average and up to 216 (docs/53).
 *
 * Progress is written back by the tutor's `[PROGRESS: CODE learning|secure]`
 * tag (parsed in the chat route, never shown to the child). A unit is done
 * when all its objectives are secure, or when the unit itself is marked
 * secure; secure items come back for review after 1, 3, 7 and 21 days.
 */

export type PlanUnit = {
  unitId: string;
  course: string;
  title: string;
  summary: string | null;
  keyConcepts: string[];
  objectives: { loCode: string; statement: string }[];
  estSessions: number;
  reviewed: boolean;
  bridge?: boolean;
  /** The part of the subject this unit belongs to (curriculum subject dictionary, 2026-11-14), e.g. "mathematics.number". */
  domain?: string;
};

/** One of the year's learning areas for a subject (curriculum year guides, 2026-11-13). */
export type PlanCategory = {
  slug: string;
  name: string;
  focus: string | null;
  keySkills: string | null;
  application: string | null;
  observableOutcome: string | null;
  guide: { name: string; slug: string; mechanic: string | null; exampleLine: string | null };
  /** Since 2026-11-14: the area's domains (first one first) and the interface of the first. */
  domains?: string[];
  interface?: string;
};

/** A kind of screen for a domain, with the tools it offers in the child's year (curriculum, 2026-11-14). Until freelee builds one, lessons stay a chat. */
export type PlanInterface = { label: string; notation: string; inputs: string[]; tools: { id: string; label: string }[] };

export type PlanSubject = {
  subject: string; fromObjectives: boolean; current: string | null; units: PlanUnit[]; categories?: PlanCategory[];
  /** Since 2026-11-14: a part of a whole subject (biology) says what it is part of and where its content comes from. */
  partOf?: string[]; source?: string; defaultDomain?: string | null;
};
export type Progress = { status: 'learning' | 'secure'; at: string; reviews: number; reviewAt?: string };

export type LevelProfile = {
  level: number;
  name: string;
  ages: string;
  linguistic?: { sentenceWords?: number[]; vocabulary?: string; questionTypes?: string[]; style?: string };
  emotional?: { praise?: string; errorHandling?: string; avoid?: string[] };
  pedagogical?: { sessionSteps?: string[] };
  narrative?: { childRole?: string; structure?: string };
  checks?: { maxReplyWords?: number; avoidPhrases?: { en?: string[] } };
};

/**
 * How a tutor talks with this school year (curriculum year profile, owner's
 * iFairy v1.0 documents). Finer than the level: Year 1 allows 20 words per
 * turn where its level allowed 70. Absent for Reception and in plans built
 * before 2026-11-13 — the level applies then.
 */
export type YearProfile = {
  yearLabel: string;
  title: string;
  deliveryModeChat: string | null;
  deliveryModeNote: string | null;
  checks: YearChecks;
  hintLadder: string[];
  fullSolutionOnlyAfterAttempt: boolean;
  modelAnswerAfterAttempt?: { maxWords?: number; learnerOpened?: boolean; kind?: string } | null;
  neverDo: string[] | null;
  progression: { phase: string; subjectEmphasis: string; supportEmphasis: string; observableExample: string }[];
};

export type Plan = {
  curriculumVersion: string;
  builtAt: string;
  year: string;
  keyStage: string | null;
  level: number | null;
  profile: LevelProfile | null;
  yearProfile?: YearProfile | null;
  subjects: PlanSubject[];
  gaps: { subject: string; note: string }[];
  reviewIntervalsDays: number[];
  studyStrategy?: string[];
  /** Since 2026-11-14: the domains and interfaces the plan uses; absent in older plans. */
  domains?: Record<string, { label: string; subject: string; interface: string }>;
  interfaces?: Record<string, PlanInterface>;
  progress: Record<string, Progress>;
};

type Pack = Omit<Plan, 'builtAt' | 'subjects' | 'progress' | 'studyStrategy'> & {
  subjects: { subject: string; fromObjectives: boolean; startAt: string | null; units: PlanUnit[]; categories?: PlanCategory[]; partOf?: string[]; source?: string; defaultDomain?: string | null }[];
  gcse?: { studyStrategy?: string[] };
};

/** Asks curriculum for the pack — learning settings only — and turns it into a fresh plan. */
export async function buildPlan(profile: ChildProfile, previous?: Plan | null): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const config = await curriculumConfig();
  if (!config) return { ok: false, error: 'The curriculum connection is not set up.' };
  const pathway = Object.fromEntries(Object.entries(profile.pathway ?? {}).filter(([, v]) => v));
  const result = await curriculumRequest<Pack>(config, {
    method: 'POST',
    path: '/v1/plan-pack',
    body: {
      year: profile.year,
      subjects: profile.subjects,
      ...(Object.keys(pathway).length ? { pathway } : {}),
      ...(profile.includePshe ? { includeSensitive: true } : {}),
    },
  }, { timeoutMs: 15_000 });
  if (!result.ok) return { ok: false, error: result.status === 404 ? 'The curriculum service does not offer plans yet.' : `The curriculum service answered: ${result.error || result.status}` };

  const pack = result.data;
  const plan: Plan = {
    curriculumVersion: pack.curriculumVersion,
    builtAt: new Date().toISOString(),
    year: pack.year,
    keyStage: pack.keyStage,
    level: pack.level,
    profile: pack.profile,
    yearProfile: pack.yearProfile ? keepYearProfile(pack.yearProfile) : null,
    subjects: pack.subjects.map((s) => ({
      subject: s.subject, fromObjectives: s.fromObjectives, current: s.startAt, units: s.units, categories: s.categories ?? [],
      ...(s.partOf ? { partOf: s.partOf, source: s.source } : {}), ...(s.defaultDomain !== undefined ? { defaultDomain: s.defaultDomain } : {}),
    })),
    gaps: pack.gaps,
    reviewIntervalsDays: pack.reviewIntervalsDays?.length ? pack.reviewIntervalsDays : [1, 3, 7, 21],
    studyStrategy: pack.gcse?.studyStrategy,
    ...(pack.domains ? { domains: pack.domains } : {}),
    ...(pack.interfaces ? { interfaces: pack.interfaces } : {}),
    // Progress is kept per objective code / unit id, so a refreshed programme keeps it.
    progress: previous?.progress ?? {},
  };
  // A refresh keeps the child where they were when that unit still exists.
  for (const s of plan.subjects) {
    const before = previous?.subjects.find((p) => p.subject === s.subject)?.current;
    if (before && s.units.some((u) => u.unitId === before)) s.current = before;
  }
  return { ok: true, plan };
}

/** The part of the pack's year profile a lesson uses (the rest stays in curriculum). */
function keepYearProfile(y: YearProfile): YearProfile {
  return {
    yearLabel: y.yearLabel, title: y.title, deliveryModeChat: y.deliveryModeChat, deliveryModeNote: y.deliveryModeNote,
    checks: y.checks, hintLadder: y.hintLadder ?? [], fullSolutionOnlyAfterAttempt: y.fullSolutionOnlyAfterAttempt !== false,
    modelAnswerAfterAttempt: y.modelAnswerAfterAttempt ?? null, neverDo: y.neverDo ?? [], progression: y.progression ?? [],
  };
}

export async function loadPlan(row: Pick<ChildProfileRow, 'id'>, key: ChildKey): Promise<Plan | null> {
  const [stored] = await db.select().from(childPlans).where(eq(childPlans.childProfileId, row.id)).limit(1);
  return stored ? openJson<Plan>(key, 'plan', stored.data) : null;
}

export async function savePlan(row: Pick<ChildProfileRow, 'id'>, key: ChildKey, plan: Plan): Promise<void> {
  const data = sealJson(key, 'plan', plan);
  await db
    .insert(childPlans)
    .values({ childProfileId: row.id, curriculumVersion: plan.curriculumVersion, data })
    .onConflictDoUpdate({ target: childPlans.childProfileId, set: { data, curriculumVersion: plan.curriculumVersion, updatedAt: new Date() } });
}

/* ------------------------------- progress ------------------------------- */

const PROGRESS_TAG_RE = /\[PROGRESS:\s*([A-Za-z0-9-]{3,80})\s+(learning|secure)\s*\]/gi;

/** The progress tags in a reply, and the reply without them. */
export function parseProgress(text: string): { text: string; marks: { code: string; status: 'learning' | 'secure' }[] } {
  const marks: { code: string; status: 'learning' | 'secure' }[] = [];
  const clean = text.replace(PROGRESS_TAG_RE, (_m, code: string, status: string) => {
    marks.push({ code, status: status.toLowerCase() as 'learning' | 'secure' });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trimEnd();
  return { text: clean, marks };
}

/** Applies marks to the plan; only codes that are in the plan count. Returns whether anything changed. */
export function applyProgress(plan: Plan, marks: { code: string; status: 'learning' | 'secure' }[], now = new Date()): boolean {
  const known = new Set(plan.subjects.flatMap((s) => s.units.flatMap((u) => [u.unitId, ...u.objectives.map((o) => o.loCode)])));
  let changed = false;
  for (const { code, status } of marks) {
    if (!known.has(code)) continue;
    const before = plan.progress[code];
    const reviews = before?.status === 'secure' && status === 'secure' ? before.reviews + 1 : status === 'secure' ? 0 : before?.reviews ?? 0;
    const days = plan.reviewIntervalsDays[Math.min(reviews, plan.reviewIntervalsDays.length - 1)];
    plan.progress[code] = {
      status,
      at: now.toISOString(),
      reviews,
      ...(status === 'secure' ? { reviewAt: new Date(now.getTime() + days * 86_400_000).toISOString() } : {}),
    };
    changed = true;
  }
  // Move each subject on once its current unit is secure (the unit itself, or every objective in it).
  for (const s of plan.subjects) {
    const i = s.units.findIndex((u) => u.unitId === s.current);
    const unit = s.units[i];
    if (!unit) continue;
    const done = plan.progress[unit.unitId]?.status === 'secure' ||
      (unit.objectives.length > 0 && unit.objectives.every((o) => plan.progress[o.loCode]?.status === 'secure'));
    if (done && i + 1 < s.units.length) {
      s.current = s.units[i + 1].unitId;
      changed = true;
    }
  }
  return changed;
}

/* --------------------------------- prompt -------------------------------- */


/**
 * What a tutor reads about this child: the developmental level (how to talk),
 * who the child is (nickname, interests, adaptations — never more), and a
 * slice of the plan — for each subject the tutor teaches, the current unit with
 * its objectives, the next unit and anything due for review. Kept short on
 * purpose (≈ 600–900 tokens): it is sent with every turn.
 */
export function learnerSection(profile: ChildProfile, plan: Plan | null, tutorSubjects: string[], now = new Date(), dict: SubjectsDictionary | null = null): string {
  const subjectLabel = (id: string) => labelOf(id, subjectOptions(dict));
  const lines: string[] = ['## Your learner'];
  lines.push(`You are teaching ${profile.pseudonym}, in ${yearLabel(profile.year)}${plan?.keyStage ? ` (${plan.keyStage})` : ''}. Call them ${profile.pseudonym}.`);
  if (profile.interests.length) lines.push(`They like: ${profile.interests.join(', ')} — use these in examples.`);
  if (profile.goals) lines.push(`Their grown-up asked to focus on: ${profile.goals}`);
  const adaptations = ADAPTATIONS.filter((a) => profile.adaptations.includes(a.id)).map((a) => `- ${a.instruction}`);
  if (adaptations.length) lines.push('Adapt every lesson:', ...adaptations);

  const y = plan?.yearProfile;
  const p = plan?.profile;
  if (y) {
    lines.push('', ...yearRules(y));
  } else if (p) {
    lines.push('', `## How to talk at this age (level ${p.level}: ${p.name}, ${p.ages})`);
    if (p.linguistic?.sentenceWords) lines.push(`- Sentences of ${p.linguistic.sentenceWords[0]}–${p.linguistic.sentenceWords[1]} words; whole reply at most ${p.checks?.maxReplyWords ?? 150} words.`);
    if (p.linguistic?.vocabulary) lines.push(`- Words: ${p.linguistic.vocabulary}`);
    if (p.linguistic?.questionTypes?.length) lines.push(`- Questions: ${p.linguistic.questionTypes.join(', ')}. Ask exactly one question per reply, at the end.`);
    if (p.emotional?.praise) lines.push(`- Praise: ${p.emotional.praise}`);
    if (p.emotional?.errorHandling) lines.push(`- When an answer is not right: ${p.emotional.errorHandling}`);
    if (p.checks?.avoidPhrases?.en?.length) lines.push(`- Never say: ${p.checks.avoidPhrases.en.map((x) => `"${x}"`).join(', ')}.`);
    if (p.pedagogical?.sessionSteps?.length) lines.push(`- A session goes: ${p.pedagogical.sessionSteps.join(' → ')}.`);
  }

  if (!plan) {
    lines.push('', 'There is no learning plan for this child yet: follow their lead within your subjects and keep to the level above.');
    return lines.join('\n');
  }

  // Through the subject dictionary (2026-11-14): a science tutor teaches the child who chose biology, an "english reading" tutor English.
  const wanted = plan.subjects.filter((s) => tutorSubjects.length === 0 || tutorSubjects.some((t) => sameFamily(t, s.subject, dict)));
  const subjects = wanted.length ? wanted : plan.subjects;
  lines.push('', '## The learning plan (shared by every tutor this child talks to)');
  for (const s of subjects) {
    const i = Math.max(0, s.units.findIndex((u) => u.unitId === s.current));
    const unit = s.units[i];
    if (!unit) continue;
    const next = s.units[i + 1];
    lines.push(`### ${subjectLabel(s.subject)} — now: ${unit.title} (unit ${unit.unitId}${unit.bridge ? ', a bridge into GCSE' : ''})`);
    if (unit.summary) lines.push(unit.summary);
    for (const area of (s.categories ?? []).slice(0, 2)) {
      lines.push(`Area: ${area.name} — ${area.focus ?? ''}${area.observableOutcome ? ` Success looks like: ${area.observableOutcome}` : ''}`);
    }
    if (unit.keyConcepts.length) lines.push(`Key ideas: ${unit.keyConcepts.join(', ')}.`);
    for (const o of unit.objectives.slice(0, 10)) {
      const state = plan.progress[o.loCode]?.status;
      lines.push(`- ${o.loCode}${state ? ` [${state}]` : ''}: ${o.statement}`);
    }
    if (next) lines.push(`Next: ${next.title}.`);
  }
  const term = y ? termOf(y, now) : null;
  if (term) lines.push('', `This term (${term.phase}): ${term.subjectEmphasis}. Support: ${term.supportEmphasis}.`);
  const due = Object.entries(plan.progress)
    .filter(([, v]) => v.status === 'secure' && v.reviewAt && new Date(v.reviewAt) <= now)
    .slice(0, 3)
    .map(([code]) => code);
  if (due.length) lines.push('', `Due for a quick review today: ${due.join(', ')} — start with one short recall question.`);
  if (plan.studyStrategy?.length) lines.push('', `Study habits for this year: ${plan.studyStrategy.join('; ')}.`);
  lines.push(
    '',
    '## Recording progress',
    'When the learner shows they understand an objective (or the whole unit), or starts working on it, add a tag on its own line ' +
      'at the very end of your reply, before any suggestions: `[PROGRESS: CODE secure]` or `[PROGRESS: CODE learning]`, with an ' +
      'objective code or unit id from the plan above. The tag is hidden from the learner. At most two tags per reply; none when nothing changed.',
  );
  return lines.join('\n');
}

/* ------------------------------ year rules ------------------------------- */

const HINT_LABELS: Record<string, string> = {
  repeat_with_emphasis: 'repeat the question with emphasis',
  repeat_with_emphasis_or_picture: 'repeat with emphasis or a picture',
  show_with_objects: 'show it with objects',
  concrete_model: 'a concrete model',
  adult_models_parallel_example: 'the adult models a similar example',
  point_to_feature: 'point to the feature that matters',
  partial_step: 'give one partial step',
  worked_parallel_example: 'a worked example of a similar question',
};

const DELIVERY: Record<string, string> = {
  adult_led: 'This is an adult-led session: the adult reads each turn aloud and types what the child says, points to or does. Speak to the child.',
  adult_supported: 'The turn is read aloud by default and an adult sits with the child.',
  child_operated_adult_nearby: 'The learner reads and answers; an adult is nearby.',
  child_operated_adult_available: 'The learner works alone; an adult is available.',
  learner_led_adult_plan: 'The learner leads, within the plan the adult set.',
  learner_led: 'The learner leads; the adult reads the report.',
};

/** Autumn September–December, Spring January–April, Summer May–August. */
function termOf(y: YearProfile, now: Date) {
  const m = now.getUTCMonth();
  return y.progression[m >= 8 ? 0 : m <= 3 ? 1 : 2] ?? null;
}

/**
 * The year's limits as instructions (≈ 250–350 tokens). The prompt aims below
 * the target: from Year 4 the target is only 10 words under the limit, and a
 * model rarely lands on an exact count (docs/52).
 */
export function yearRules(y: YearProfile): string[] {
  const c = y.checks;
  const aim = Math.min(c.targetReplyWords ?? c.maxReplyWords, Math.round(c.maxReplyWords * 0.75));
  const out = [`## How to talk in ${y.title}`];
  if (y.deliveryModeChat && DELIVERY[y.deliveryModeChat]) out.push(`- ${DELIVERY[y.deliveryModeChat]}`);
  out.push(`- Each reply: about ${aim} words, never more than ${c.maxReplyWords}. Sentences of about ${c.sentenceWords[0]} words, never more than ${c.sentenceWords[1]}${c.maxSentencesPerTurn ? `; at most ${c.maxSentencesPerTurn} sentences` : ''}.`);
  out.push('- Exactly one question or one action per reply — never two questions joined by "and", never a question hidden in an instruction.');
  if (c.adultNoteMaxWords) out.push(`- You may start with one line "For the adult: …" (at most ${c.adultNoteMaxWords} words, preparation only, no question). It does not count towards the learner's words.`);
  out.push(`- Feedback names what the learner did${c.feedbackMaxWords ? `, in at most ${c.feedbackMaxWords} words` : ''}. No praise words (brilliant, amazing, clever, well done…), no scores, no comparisons with others.`);
  out.push(`- You are a learning tool, not a person or a friend: never say "I", "me", "my", "we", "us" or "let's", and never claim feelings${c.firstPersonException ? ' (except inside a labelled language role-play)' : ''}.`);
  if (c.newTermsMax) out.push(`- At most ${c.newTermsMax} new term${c.newTermsMax > 1 ? 's' : ''} per reply, each with a short definition.`);
  if (c.negationsPerTurnMax === 0) out.push('- No negatives in an instruction ("not", "don\'t", "never").');
  if (c.optionsMax) out.push(`- When you offer choices, at most ${c.optionsMax}.`);
  const ladder = y.hintLadder.map((h) => HINT_LABELS[h] ?? h.replace(/_/g, ' '));
  if (ladder.length) out.push(`- After a wrong or missing answer, one hint at a time: ${ladder.join(' → ')}. ${y.fullSolutionOnlyAfterAttempt ? 'Show the full answer only after a genuine attempt.' : ''}`.trim());
  if (y.modelAnswerAfterAttempt?.maxWords) out.push(`- A model answer only after an attempt and only when the learner asks, at most ${y.modelAnswerAfterAttempt.maxWords} words, labelled as iFairy practice.`);
  if (y.neverDo?.length) out.push(`- Never: ${y.neverDo.map((n) => n.replace(/\.$/, '')).join('; ')}.`);
  return out;
}
