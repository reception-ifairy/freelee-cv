/**
 * The one-level nesting cap. Enforced by the server action, so it is worth
 * testing as a rule rather than trusting the UI not to offer the option.
 * Run with `npx tsx scripts/verify-block-nesting.ts`.
 */
import { canNest } from '@/lib/blocks/catalog';

const topLevelContainer = { type: 'columns', parentId: null };
const nestedContainer = { type: 'columns', parentId: 7 };
const nonContainer = { type: 'hero', parentId: null };

const cases: [string, boolean, boolean][] = [
  ['ordinary block into a top-level container', canNest(topLevelContainer, 'faq'), true],
  ['text block into a top-level container', canNest(topLevelContainer, 'custom_content'), true],
  ['container into a container (the cap)', canNest(topLevelContainer, 'columns'), false],
  ['block into an already-nested container', canNest(nestedContainer, 'faq'), false],
  ['block into a non-container block', canNest(nonContainer, 'faq'), false],
  ['block into a missing parent', canNest(null, 'faq'), false],
  ['unknown child type', canNest(topLevelContainer, 'not_a_block'), false],
  ['unknown parent type', canNest({ type: 'gone', parentId: null }, 'faq'), false],
];

let pass = 0;
for (const [name, got, expected] of cases) {
  const ok = got === expected;
  if (ok) pass++;
  console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(46), got, '(expected', expected + ')');
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
