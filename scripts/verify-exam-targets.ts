/**
 * Checks the target-exam rules (src/lib/children/exams.ts): the school year a
 * sitting falls in, months to go, the series of a month, what the plan pack
 * receives (never a date), which exams a year offers. No network, no database.
 *
 *   npx tsx scripts/verify-exam-targets.ts
 */
import { atYearFor, examLabel, examsForYear, monthsUntil, seriesForMonth, sittingLabel, targetRequest, type ExamOption } from '../src/lib/children/exams';

const now = new Date(Date.UTC(2026, 10, 14)); // 14 November 2026
const ma: ExamOption = { id: 'igcse-edexcel-4ma1', title: 'International GCSE Mathematics A', family: 'qualification', kind: 'igcse', board: 'edexcel', code: '4MA1', years: { typical: 'Y11', from: 'Y10' }, series: ['summer', 'november'], tiers: ['foundation', 'higher'], subjects: ['mathematics'], access: 'private-candidate', barriers: [], verified: true };
const ks2: ExamOption = { id: 'sta-ks2-tests', title: 'Key stage 2 national curriculum tests', family: 'school-check', kind: 'sta', years: { typical: 'Y6' }, series: ['summer'], subjects: ['english', 'mathematics'], access: 'practice-only', barriers: [], verified: true, practice: [{ id: 'gps-1', label: 'Grammar paper 1' }] };
const abrsm: ExamOption = { id: 'graded-abrsm-music', title: 'ABRSM music grades', family: 'graded', kind: 'graded', board: 'abrsm', series: [], levels: [{ id: 'grade-5', label: 'Grade 5' }], subjects: ['music'], access: 'provider', barriers: ['practical-exam'], verified: true };

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

console.log('Target exams');
check('a Year 9 child in November 2026 sits June 2028 in Year 10 (school years turn in September)', () => atYearFor('Y9', '2028-06', now) === 'Y10');
check('a Year 10 child sits June 2027 in Year 10 and November 2027 in Year 11', () => atYearFor('Y10', '2027-06', now) === 'Y10' && atYearFor('Y10', '2027-11', now) === 'Y11');
check('after Year 11 is not planned', () => atYearFor('Y11', '2028-06', now) === null);
check('a past sitting gives an earlier year, never below Reception', () => atYearFor('Y5', '2025-06', now) === 'Y3' && atYearFor('Y1', '2020-06', now) === 'Reception');
check('months to go', () => monthsUntil('2028-06', now) === 19 && monthsUntil('2026-11', now) === 0 && monthsUntil('2026-06', now) === -5);
check('series of a month', () => seriesForMonth(6) === 'summer' && seriesForMonth(11) === 'november' && seriesForMonth(1) === 'january' && seriesForMonth(7) === null);
check('the plan pack gets the exam, the school year, a series and tier the exam has — never the date', () => {
  const r = targetRequest({ exam: ma.id, sitting: '2028-06', tier: 'higher' }, ma, 'Y9', now);
  return JSON.stringify(r) === JSON.stringify({ exam: ma.id, atYear: 'Y10', series: 'summer', tier: 'higher' }) && !JSON.stringify(r).includes('2028');
});
check('a series or tier the exam does not have is left out (the curriculum default applies)', () => {
  const r = targetRequest({ exam: ma.id, sitting: '2028-01', tier: 'expert' }, ma, 'Y10', now);
  return r !== null && !('series' in r) && !('tier' in r);
});
check('a graded exam carries its level', () => JSON.stringify(targetRequest({ exam: abrsm.id, sitting: '2027-03', level: 'grade-5' }, abrsm, 'Y4', now)) === JSON.stringify({ exam: abrsm.id, atYear: 'Y4', level: 'grade-5' }));
check('Year 5 is offered the KS2 tests and graded exams, not GCSE', () => {
  const ids = examsForYear([ma, ks2, abrsm], 'Y5').map((e) => e.id);
  return ids.includes('sta-ks2-tests') && ids.includes('graded-abrsm-music') && !ids.includes(ma.id);
});
check('Year 8 is offered qualifications, no longer the KS2 tests', () => {
  const ids = examsForYear([ma, ks2, abrsm], 'Y8').map((e) => e.id);
  return ids.includes(ma.id) && !ids.includes('sta-ks2-tests');
});
check('labels', () => sittingLabel('2028-06') === 'June 2028' && examLabel(ma, { edexcel: 'Pearson Edexcel' }) === 'International GCSE Mathematics A (Pearson Edexcel 4MA1)' && examLabel(ks2) === ks2.title);

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll target-exam checks passed.');
