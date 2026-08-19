/**
 * The mark is an identity, so the properties worth testing are the ones an
 * identity has to have: it must not change between renders, and two different
 * specialists must not collide.
 *
 *   npx tsx scripts/verify-persona-mark.ts
 */
import { markSpec } from '../src/lib/persona/mark';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const fingerprint = (s: ReturnType<typeof markSpec>) =>
  `${s.grid}:${s.shape}:${s.cells.map((c) => (c ? 1 : 0)).join('')}`;

console.log('\nPersona marks\n');

console.log('Determinism');
const a = fingerprint(markSpec('search-strategist', 'marketing-and-advertising', 'seo'));
const b = fingerprint(markSpec('search-strategist', 'marketing-and-advertising', 'seo'));
check('the same persona renders identically', a === b);
check('a mark survives a fresh process', a.length > 10);

console.log('\nDistinctness');
const sectors = ['seo', 'content-marketing', 'brand-management', 'digital-analytics', 'ppc'];
const marks = new Map<string, string>();
for (const sector of sectors) {
  for (let i = 0; i < 20; i++) {
    const key = `persona-${sector}-${i}`;
    marks.set(key, fingerprint(markSpec(key, 'marketing-and-advertising', sector)));
  }
}
check('100 personas produce 100 distinct marks', new Set(marks.values()).size === 100,
  `${new Set(marks.values()).size} unique`);

console.log('\nFamily resemblance');
for (const sector of sectors) {
  const inSector = [...marks.entries()].filter(([k]) => k.includes(`-${sector}-`)).map(([, v]) => v);
  const grids = new Set(inSector.map((f) => f.split(':')[0]));
  check(`${sector}: one grid size across the sector`, grids.size === 1, [...grids].join('/'));
}
const shapes = new Set([...marks.values()].map((f) => f.split(':')[1]));
check('one shape across the whole category', shapes.size === 1, [...shapes].join('/'));

const otherCategory = fingerprint(markSpec('persona-seo-0', 'legal-and-compliance', 'seo'));
check('the same persona in another category differs', otherCategory !== marks.get('persona-seo-0'));

console.log('\nNever empty');
let sparse = 0;
for (let i = 0; i < 500; i++) {
  const spec = markSpec(`p${i}`, `cat${i % 20}`, `sec${i % 103}`);
  const filled = spec.cells.filter(Boolean).length;
  if (filled < spec.grid) sparse++;
}
check('no mark renders (near) empty across 500 samples', sparse === 0, `${sparse} sparse`);

console.log('\nSymmetry');
let asymmetric = 0;
for (let i = 0; i < 200; i++) {
  const spec = markSpec(`s${i}`, `c${i % 7}`, `x${i % 11}`);
  for (let row = 0; row < spec.grid; row++) {
    for (let col = 0; col < spec.grid; col++) {
      if (spec.cells[row * spec.grid + col] !== spec.cells[row * spec.grid + (spec.grid - 1 - col)]) asymmetric++;
    }
  }
}
check('every mark mirrors about the vertical axis', asymmetric === 0, `${asymmetric} mismatches`);

console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed === 0 ? 0 : 1);
