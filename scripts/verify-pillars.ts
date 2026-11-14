/**
 * Checks the six markets (src/lib/taxonomy/pillars.ts): every one of the 70
 * audience segments belongs to exactly one market, the education segments
 * filed under Business and Public sector go to Schools, and a bot's market
 * follows the rules in order — tutor, own segment of its own type, its
 * category's, its type's default. No network, no database.
 *
 *   npx tsx scripts/verify-pillars.ts
 */
import { AUDIENCE_SEGMENTS } from '../src/lib/persona/audience-segments';
import { PILLARS, pillarOfPersona, pillarOfSegment, pillarsOfCategory, segmentsOfPillar, type PillarInput } from '../src/lib/taxonomy/pillars';

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

console.log('Markets');
const codes = Object.keys(AUDIENCE_SEGMENTS);
check('70 segments, every one in exactly one market', () => {
  const unplaced = codes.filter((c) => pillarOfSegment(c) === null);
  const total = PILLARS.reduce((n, p) => n + segmentsOfPillar(p.id).length, 0);
  return (codes.length === 70 && unplaced.length === 0 && total === 70) || `codes ${codes.length}, unplaced ${unplaced}, total ${total}`;
});
check('segments per market: Business 20, Family 13, Schools 7, Adults 7, Interests 6, Public 17', () =>
  expect(PILLARS.map((p) => segmentsOfPillar(p.id).length), [20, 13, 7, 7, 6, 17]));
check('education segments filed under B2B or B2G go to Schools', () =>
  ['B2B-SEC-01', 'B2B-SEC-02', 'B2B-FUN-01', 'B2G-PUB-01', 'B2G-PUB-02', 'B2G-PUB-03', 'B2G-PUB-04'].every((c) => pillarOfSegment(c) === 'schools'));
check('the rest of those families stay where their type puts them', () =>
  expect([pillarOfSegment('B2B-SEC-03'), pillarOfSegment('B2B-FUN-02'), pillarOfSegment('B2G-PUB-05'), pillarOfSegment('B2G-CEN-01')], ['business', 'business', 'public', 'public']));
check('parents of young children are Family; other adults are Adults; interests are Interests', () =>
  expect([pillarOfSegment('B2C-ADU-03'), pillarOfSegment('B2C-ADU-01'), pillarOfSegment('B2C-GK-01'), pillarOfSegment('B2C-INT-01')], ['homeschooling', 'adults', 'homeschooling', 'interests']));
check('an unknown code has no market', () => pillarOfSegment('B2C-XYZ-01') === null);
check('ids and colours are unique; live markets have a page, planned ones none', () => {
  const ids = new Set(PILLARS.map((p) => p.id));
  const colours = new Set(PILLARS.map((p) => p.color));
  return ids.size === 6 && colours.size === 6 && PILLARS.every((p) => (p.status === 'live') === (p.offeringSlug !== null));
});

console.log('A bot’s market');
const bot = (over: Partial<PillarInput>): PillarInput => ({ audienceType: 'B2C', audienceSegments: [], isTutor: false, categorySegments: [], ...over });
check('a curriculum tutor is Family, whatever its segments', () => pillarOfPersona(bot({ isTutor: true, audienceSegments: ['B2C-INT-01'] })) === 'homeschooling');
check('its first own segment of its own type decides', () => pillarOfPersona(bot({ audienceSegments: ['B2B-SEC-01', 'B2C-INT-02', 'B2C-CYP-01'] })) === 'interests');
check('segments of another type never decide — the category does', () =>
  pillarOfPersona(bot({ audienceSegments: ['B2B-SEC-01', 'B2G-PUB-04'], categorySegments: ['B2B-SEC-02', 'B2C-CYP-08'] })) === 'homeschooling');
check('no segment of its type anywhere: the default for its type', () =>
  expect([pillarOfPersona(bot({})), pillarOfPersona(bot({ audienceType: 'B2B' })), pillarOfPersona(bot({ audienceType: 'B2G' }))], ['adults', 'business', 'public']));
check('a B2B bot in Education with no own segment goes where the field’s first B2B group goes', () =>
  pillarOfPersona(bot({ audienceType: 'B2B', categorySegments: ['B2C-CYP-08', 'B2B-SEC-02', 'B2B-FUN-03'] })) === 'schools');
check('no audience type at all: Business', () => pillarOfPersona(bot({ audienceType: null, audienceSegments: ['B2C-CYP-01'] })) === 'business');

console.log('A field’s markets');
check('its groups and its bots, in catalogue order, once each', () =>
  expect(pillarsOfCategory(['B2B-SEC-02', 'B2C-CYP-08', 'B2B-FUN-03'], ['adults', 'homeschooling', 'business']), ['business', 'homeschooling', 'schools', 'adults']));
check('a field with nothing serves no market', () => expect(pillarsOfCategory([], []), []));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll pillar checks passed.');
