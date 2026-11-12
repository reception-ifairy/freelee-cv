import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { childPlans, type ChildProfileRow } from '@/db/schema';
import { curriculumConfig, curriculumRequest } from '@/lib/curriculum/client';
import { openJson, sealJson, type ChildKey } from '@/lib/crypto/envelope';
import { ADAPTATIONS, SUBJECTS, yearLabel, type ChildProfile } from './profile';

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
};

export type PlanSubject = { subject: string; fromObjectives: boolean; current: string | null; units: PlanUnit[] };
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

export type Plan = {
  curriculumVersion: string;
  builtAt: string;
  year: string;
  keyStage: string | null;
  level: number | null;
  profile: LevelProfile | null;
  subjects: PlanSubject[];
  gaps: { subject: string; note: string }[];
  reviewIntervalsDays: number[];
  studyStrategy?: string[];
  progress: Record<string, Progress>;
};

type Pack = Omit<Plan, 'builtAt' | 'subjects' | 'progress' | 'studyStrategy'> & {
  subjects: { subject: string; fromObjectives: boolean; startAt: string | null; units: PlanUnit[] }[];
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
    subjects: pack.subjects.map((s) => ({ subject: s.subject, fromObjectives: s.fromObjectives, current: s.startAt, units: s.units })),
    gaps: pack.gaps,
    reviewIntervalsDays: pack.reviewIntervalsDays?.length ? pack.reviewIntervalsDays : [1, 3, 7, 21],
    studyStrategy: pack.gcse?.studyStrategy,
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

const subjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id;

/**
 * What a tutor reads about this child: the developmental level (how to talk),
 * who the child is (nickname, interests, adaptations — never more), and a
 * slice of the plan — for each subject the tutor teaches, the current unit with
 * its objectives, the next unit and anything due for review. Kept short on
 * purpose (≈ 600–900 tokens): it is sent with every turn.
 */
export function learnerSection(profile: ChildProfile, plan: Plan | null, tutorSubjects: string[], now = new Date()): string {
  const lines: string[] = ['## Your learner'];
  lines.push(`You are teaching ${profile.pseudonym}, in ${yearLabel(profile.year)}${plan?.keyStage ? ` (${plan.keyStage})` : ''}. Call them ${profile.pseudonym}.`);
  if (profile.interests.length) lines.push(`They like: ${profile.interests.join(', ')} — use these in examples.`);
  if (profile.goals) lines.push(`Their grown-up asked to focus on: ${profile.goals}`);
  const adaptations = ADAPTATIONS.filter((a) => profile.adaptations.includes(a.id)).map((a) => `- ${a.instruction}`);
  if (adaptations.length) lines.push('Adapt every lesson:', ...adaptations);

  const p = plan?.profile;
  if (p) {
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

  const wanted = plan.subjects.filter((s) => tutorSubjects.length === 0 || tutorSubjects.includes(s.subject));
  const subjects = wanted.length ? wanted : plan.subjects;
  lines.push('', '## The learning plan (shared by every tutor this child talks to)');
  for (const s of subjects) {
    const i = Math.max(0, s.units.findIndex((u) => u.unitId === s.current));
    const unit = s.units[i];
    if (!unit) continue;
    const next = s.units[i + 1];
    lines.push(`### ${subjectLabel(s.subject)} — now: ${unit.title} (unit ${unit.unitId}${unit.bridge ? ', a bridge into GCSE' : ''})`);
    if (unit.summary) lines.push(unit.summary);
    if (unit.keyConcepts.length) lines.push(`Key ideas: ${unit.keyConcepts.join(', ')}.`);
    for (const o of unit.objectives.slice(0, 10)) {
      const state = plan.progress[o.loCode]?.status;
      lines.push(`- ${o.loCode}${state ? ` [${state}]` : ''}: ${o.statement}`);
    }
    if (next) lines.push(`Next: ${next.title}.`);
  }
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
