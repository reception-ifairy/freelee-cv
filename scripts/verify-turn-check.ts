/**
 * Checks the year-limit validator (src/lib/children/turn-check.ts) on the
 * owner's own examples from the iFairy v1.0 year documents (Part 0.12) and the
 * cases the November 2026 review found: stacked questions, "us", praise, the
 * Year 1 "Yes or no" confirmation. No network, no model.
 *
 *   npx tsx scripts/verify-turn-check.ts
 */
import { checkTurn, countWords, splitTurn, type YearChecks } from '../src/lib/children/turn-check';

// The Year 1 and Year 4 checks as curriculum serves them (GET /v1/years/:year/profile).
const Y1: YearChecks = {
  sentenceWords: [6, 10], maxReplyWords: 20, targetReplyWords: 12, maxSentencesPerTurn: 3, questionsPerReply: 1,
  feedbackMaxWords: 8, optionsMax: 3, newTermsMax: 1, adultNoteMaxWords: 25, negationsPerTurnMax: 0, firstPersonException: null,
  avoidPhrases: { en: ['wrong', 'easy', 'simple'] },
};
const Y4: YearChecks = {
  sentenceWords: [10, 15], maxReplyWords: 50, targetReplyWords: 40, maxSentencesPerTurn: 5, questionsPerReply: 1,
  feedbackMaxWords: 20, optionsMax: 3, newTermsMax: 2, adultNoteMaxWords: 25, negationsPerTurnMax: 1, firstPersonException: 'language_roleplay',
};

let failed = 0;
function check(name: string, fn: () => boolean) {
  try {
    if (!fn()) throw new Error('returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
const rules = (reply: string, c: YearChecks, roleplay = false) => checkTurn(reply, c, { roleplay }).problems.map((p) => p.rule);

const flooding = "Hello, brave explorer! Today we're going on a magical sound adventure through the Whispering Woods, where every tree hums a different phoneme. First, let's remember what we learned yesterday about the 'sh' sound, and then I'll show you three new words, and you can tell me which one starts with 'ch', and afterwards we'll write a sentence together!";

check('Year 1 flooding turn (58 words) breaks length, sentence and first-person limits', () => {
  const r = rules(flooding, Y1);
  return r.includes('turn length') && r.includes('sentence length') && r.includes('first person');
});
check('Year 1 good turn passes; the "For the adult" line is not counted', () => {
  const r = checkTurn('For the adult: show the shell and chair cards.\n"Listen: *ship*. Which picture starts like *ship*?"', Y1);
  return r.problems.length === 0 && r.adultNote === 'show the shell and chair cards.' && r.words === 7;
});
check('hidden lines (Objective, PROGRESS, SUGGESTIONS) are not the learner\'s text', () => {
  const { learnerText } = splitTurn('Count the dots. How many?\nObjective: MA-Y1-NUM-001\n[PROGRESS: MA-Y1-NUM-001 learning]\n[SUGGESTIONS: 3 | 4]');
  return learnerText === 'Count the dots. How many?';
});
check('Year 1: a negative instruction is refused, a "Yes or no" confirmation is not', () =>
  rules('Which one is not red?', Y1).includes('negation') && rules('Did you say cat? Yes or no.', Y1).length === 0);
check('two questions joined by "and" are one question too many', () =>
  rules('Which readings make the comparison fair, and why?', Y4).includes('one question'));
check('"us" is first person (DfE: function-based phrasing)', () =>
  rules('What can it tell us about daily life?', Y4).includes('first person'));
check('first person is allowed only inside a labelled language role-play', () =>
  rules('Bonjour! I am a waiter. What would you like?', Y4, true).length === 0);
check('praise words are refused ("Great effort!")', () => rules('Your paragraph flows now. Great effort!', Y4).includes('praise'));
check('the Year 4 good turn "7 × 8 = ? Close. Start with 7 × 4." passes; symbols alone are not words', () =>
  rules('7 × 8 = ? Close. Start with 7 × 4.', Y4).length === 0 && countWords('7 × 8 = ?') === 2);
check('a question in the adult line is refused', () => rules('For the adult: is the child ready?\nPoint to the cat.', Y1).includes('adult line'));

console.log(failed ? `\n${failed} check(s) failed` : '\nturn check: all checks passed');
process.exit(failed ? 1 : 0);
