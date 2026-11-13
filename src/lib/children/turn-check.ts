/**
 * Does a tutor's reply keep the limits of the learner's school year?
 *
 * The limits come from curriculum's year profiles (`GET /v1/years/:year/profile`,
 * the plan pack's `yearProfile.checks`), written from the owner's iFairy v1.0
 * documents (2026-11-13). Each year has a target and a never-exceed value for
 * the tutor's text: Year 1 at most 20 words per turn, read aloud by an adult;
 * Year 11 at most 130. These are the same rules as the documents' Part 3
 * validator and curriculum's `validatorLists`. A reply is split into the
 * optional "For the adult:" line and the part the learner reads; only the
 * learner's part is held to the year's limits.
 *
 * Pure code, no model call: the measurement bench (scripts/tutor-bench.ts) uses
 * it today. Checking a reply before it is shown — regenerate once, then fall
 * back to the guide's line — is the next step, once the bench shows how often
 * tutors overshoot (docs/53).
 */

export type YearChecks = {
  /** [target, never exceed] words per sentence. */
  sentenceWords: [number, number] | number[];
  maxReplyWords: number;
  targetReplyWords?: number;
  maxSentencesPerTurn?: number;
  questionsPerReply: number;
  feedbackMaxWords?: number | null;
  optionsMax?: number;
  newTermsMax?: number;
  adultNoteMaxWords?: number;
  /** 0 in Year 1 (no negation in instructions), 1 in Years 2–4, null after. */
  negationsPerTurnMax?: number | null;
  firstPersonException?: string | null;
  avoidPhrases?: { en?: string[]; pl?: string[] } | string[];
};

export type TurnProblem = { rule: string; detail: string };
export type TurnReport = {
  learnerText: string;
  adultNote: string | null;
  words: number;
  sentences: number;
  longestSentence: number;
  questions: number;
  problems: TurnProblem[];
};

/** Same lists as curriculum's year-parameters.json `validatorLists`. */
const FIRST_PERSON = /\b(I|I'm|I've|I'll|I'd|me|my|myself|we|we're|we've|us|our|ours|let's)\b/i;
const PRAISE = ['brilliant', 'amazing', 'clever', 'superstar', 'great job', 'good job', 'great work', 'great effort',
  'nice work', 'well done', 'awesome', 'fantastic', 'excellent', 'perfect', 'genius', 'good girl', 'good boy'];
const NEGATION = /\b(not|don't|doesn't|isn't|aren't|can't|won't|no|never|none)\b/gi;
const STACKED = /\b(and|or)\s+(what|how|why|which|where|when|who|whose|was|were|is|are|does|do|did|will|would|could|can|should)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A word: a whitespace-separated token with a letter, digit, currency or per cent sign (× or = alone are not words). */
export function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}£$€%]/u.test(w)).length;
}

export function splitSentences(s: string): string[] {
  return s.split(/\n+|(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => countWords(x) > 0);
}

/**
 * The part of a reply the learner reads, and the adult's line: without the
 * hidden lines the chat strips (`[SUGGESTIONS: …]`, `[PROGRESS: …]`,
 * `Objective: …`) and without markdown emphasis.
 */
export function splitTurn(reply: string): { learnerText: string; adultNote: string | null } {
  let adultNote: string | null = null;
  const kept: string[] = [];
  for (const raw of reply.split('\n')) {
    const line = raw.trim();
    if (/^\[SUGGESTIONS:.*\]$/i.test(line) || /^Objective:/i.test(line)) continue;
    const adult = line.replace(/[*_]/g, '').match(/^For the adult:\s*(.*)$/i);
    if (adult) {
      adultNote = adult[1].trim();
      continue;
    }
    kept.push(raw);
  }
  const learnerText = kept.join('\n')
    .replace(/\[PROGRESS:[^\]]*\]/gi, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return { learnerText, adultNote };
}

export function checkTurn(reply: string, checks: YearChecks, opts: { roleplay?: boolean } = {}): TurnReport {
  const { learnerText, adultNote } = splitTurn(reply);
  const list = splitSentences(learnerText);
  const lengths = list.map(countWords);
  const words = countWords(learnerText);
  const longest = Math.max(0, ...lengths);
  const questions = (learnerText.match(/\?/g) ?? []).length;
  const problems: TurnProblem[] = [];
  const add = (rule: string, detail: string) => problems.push({ rule, detail });

  if (words > checks.maxReplyWords) add('turn length', `${words} words (limit ${checks.maxReplyWords})`);
  const sentenceMax = checks.sentenceWords[1];
  if (sentenceMax && longest > sentenceMax) add('sentence length', `longest sentence ${longest} words (limit ${sentenceMax})`);
  if (checks.maxSentencesPerTurn && list.length > checks.maxSentencesPerTurn) add('sentences per turn', `${list.length} (limit ${checks.maxSentencesPerTurn})`);
  if (questions > checks.questionsPerReply) add('one question', `${questions} questions`);
  const stacked = list.find((s) => s.includes('?') && STACKED.test(s));
  if (stacked) add('one question', `two questions joined: "${stacked.match(STACKED)?.[0]}"`);

  const fp = learnerText.match(FIRST_PERSON);
  if (fp && !opts.roleplay) add('first person', `"${fp[0]}"`);
  const lower = learnerText.toLowerCase();
  const praise = PRAISE.filter((p) => new RegExp(`\\b${escape(p)}\\b`).test(lower));
  if (praise.length) add('praise', praise.join(', '));
  const avoid = Array.isArray(checks.avoidPhrases) ? checks.avoidPhrases : checks.avoidPhrases?.en ?? [];
  const said = avoid.filter((p) => !PRAISE.includes(p) && new RegExp(`\\b${escape(p.toLowerCase())}\\b`).test(lower));
  if (said.length) add('avoided phrase', said.join(', '));

  if (checks.negationsPerTurnMax != null) {
    // "Yes or no" is how a spoken answer is confirmed, not a negative instruction.
    const negatives = learnerText.replace(/\byes or no\b/gi, '').match(NEGATION) ?? [];
    if (negatives.length > checks.negationsPerTurnMax) add('negation', `${negatives.length} (${negatives.join(', ')}; limit ${checks.negationsPerTurnMax})`);
  }
  if (adultNote !== null) {
    const n = countWords(adultNote);
    if (checks.adultNoteMaxWords && n > checks.adultNoteMaxWords) add('adult line', `${n} words (limit ${checks.adultNoteMaxWords})`);
    if (adultNote.includes('?')) add('adult line', 'asks a question; the adult line is preparation only');
  }
  return { learnerText, adultNote, words, sentences: list.length, longestSentence: longest, questions, problems };
}
