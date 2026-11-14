/**
 * Checks the homeschool hub (freelee #83):
 * - the coverage grid (src/lib/curriculum/coverage.ts) matches tutors the way
 *   lessons do — key stage in scope, subject the same or part of one whole —
 *   and counts only the cells a parent can actually choose;
 * - the family counts (src/lib/children/admin-counts.ts) never read a child's
 *   sealed data: no `data` or `wrapped_key` column, no select-all, nothing
 *   from the profile store or the crypto. Static checks on the source, so an
 *   edit that reaches for content fails here before it ships.
 * No network, no database.
 *
 *   npx tsx scripts/verify-tutor-coverage.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHILD_KEY_STAGES, coverageGrid, type CoverageTutor } from '../src/lib/curriculum/coverage';
import type { SubjectsDictionary } from '../src/lib/curriculum/subjects';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function check(name: string, fn: () => boolean | string) {
  try {
    const r = fn();
    if (r !== true) throw new Error(typeof r === 'string' ? r : 'returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
const expect = (got: unknown, want: unknown) => JSON.stringify(got) === JSON.stringify(want) || `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`;

const dict: SubjectsDictionary = {
  version: 'test', hash: 'x', fetchedAt: '2026-11-14T00:00:00Z',
  options: [
    { id: 'mathematics', label: 'Maths' },
    { id: 'science', label: 'Science' },
    { id: 'biology', label: 'Biology', partOf: 'science', from: 'Y7' },
    { id: 'religious education', label: 'RE', to: 'Y8' },
    { id: 'pshe', label: 'PSHE', sensitive: true },
    { id: 'citizenship', label: 'Citizenship', childSelectable: false },
  ],
  aliases: { maths: 'mathematics' },
  parts: {},
};
const tutors: CoverageTutor[] = [
  { id: 1, name: 'Maths KS2', isActive: true, keyStages: ['KS2'], subjects: ['maths'] },
  { id: 2, name: 'Science KS3', isActive: false, keyStages: ['KS3'], subjects: ['science'] },
  { id: 3, name: 'Biology KS4', isActive: true, keyStages: ['KS4'], subjects: ['biology'] },
];
const grid = coverageGrid(tutors, dict);
const cell = (subject: string, ks: string) => grid.rows.find((r) => r.option.id === subject)!.cells.find((c) => c.keyStage === ks)!;

console.log('Coverage grid');
check('key stages a child can be in: KS1–KS4', () => expect([...CHILD_KEY_STAGES], ['KS1', 'KS2', 'KS3', 'KS4']));
check('rows are the subjects a parent can choose: not consent-only (PSHE), not unselectable', () =>
  expect(grid.rows.map((r) => r.option.id), ['mathematics', 'science', 'biology', 'religious education']));
check('a synonym in a tutor’s scope ("maths") counts for the subject', () => expect([cell('mathematics', 'KS2').live, cell('mathematics', 'KS2').total], [1, 1]));
check('only at the key stages in the tutor’s scope', () => cell('mathematics', 'KS1').total === 0 && cell('mathematics', 'KS3').total === 0);
check('a science tutor teaches biology, and a biology tutor counts for science (one whole)', () =>
  cell('biology', 'KS3').total === 1 && cell('science', 'KS4').live === 1);
check('a tutor that is not live counts in all, not in live', () => expect([cell('science', 'KS3').live, cell('science', 'KS3').total], [0, 1]));
check('cells outside a subject’s years are not offered and never count (biology before Y7, RE after Y8)', () =>
  !cell('biology', 'KS2').offered && cell('biology', 'KS2').total === 0 && !cell('religious education', 'KS4').offered && cell('religious education', 'KS3').offered);
check('the summary counts offered cells only', () => {
  // maths 4 + science 4 + biology 2 (KS3, KS4) + RE 3 (KS1–KS3) = 13 offered;
  // live: maths KS2, science KS4, biology KS4 = 3; any: + science KS3, biology KS3 = 5.
  return expect([grid.offered, grid.coveredLive, grid.coveredAny], [13, 3, 5]);
});
check('no tutors: every offered cell is 0/0', () => coverageGrid([], dict).rows.every((r) => r.cells.every((c) => c.total === 0)));
check('without a fetched dictionary the built-in subject list is used', () => coverageGrid(tutors, null).rows.length >= 10);

console.log('Families: numbers only');
const counts = readFileSync(join(ROOT, 'src/lib/children/admin-counts.ts'), 'utf8');
const code = counts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('never names the sealed columns (data, wrapped_key)', () =>
  !/\.(data|wrappedKey)\b/.test(code) || `found ${code.match(/\.(data|wrappedKey)\b/g)}`);
check('never selects whole rows: every select names its columns', () => !/\.select\(\s*\)/.test(code));
check('imports nothing that can open a profile (store, crypto, envelope)', () =>
  !/from ['"][^'"]*(children\/store|crypto|envelope|\.\/store)['"]/.test(code));
check('returns aggregates only: every column it reads is counted or grouped', () => {
  const selects = code.match(/\.select\(\{[\s\S]*?\}\)/g) ?? [];
  return selects.length === 3 && selects.every((s) => /count\(/.test(s));
});

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll tutor-coverage checks passed.');
