/**
 * Checks the dashboard's attention list (src/lib/admin/attention.ts): items
 * appear only when there is something to do, in order act → check → tidy, the
 * header badge counts only what someone is waiting on, and the tutor item
 * appears only while the homeschooling page promises lessons. No network, no
 * database.
 *
 *   npx tsx scripts/verify-attention.ts
 */
import { actCount, attentionItems, type AttentionFacts } from '../src/lib/admin/attention';

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

const quiet: AttentionFacts = {
  pendingOrders: 0, newLeads: 0, listingsToReview: 0, failingConnections: [], untestedConnections: [],
  liveTutors: 1, homeschoolPagePublished: true, fieldsWithoutBots: 0, fieldsWithoutAudiences: 0,
  botsWithOtherTypeGroups: 0, belowRiskFloor: [],
};

console.log('Attention');
check('nothing to do: no items, no badge', () => attentionItems(quiet).length === 0 && actCount(attentionItems(quiet)) === 0);
const busy = attentionItems({
  ...quiet,
  pendingOrders: 2, newLeads: 1, failingConnections: ['Resend — email'], untestedConnections: ['Ollama'],
  liveTutors: 0, fieldsWithoutBots: 6, botsWithOtherTypeGroups: 55,
  belowRiskFloor: [{ pillar: 'adults', label: 'Adults: life & career', fields: 5 }],
});
check('ordered act → check → tidy', () =>
  expect(busy.map((i) => i.level), ['act', 'act', 'act', 'check', 'check', 'check', 'tidy', 'tidy']));
check('the badge counts things someone is waiting on (orders, leads, a failing connection), not tidying', () => actCount(busy) === 3);
check('counts read as sentences, singular and plural', () =>
  expect(busy.filter((i) => ['orders', 'leads', 'fields-no-bots'].includes(i.id)).map((i) => i.title), [
    '2 orders awaiting payment confirmation', '1 new lead', '6 fields have no bot',
  ]));
check('a failing connection is named', () => busy.find((i) => i.id === 'connections-failing')!.detail.includes('Resend — email'));
check('no live tutor matters only while the homeschooling page is published', () =>
  attentionItems({ ...quiet, liveTutors: 0, homeschoolPagePublished: false }).length === 0 &&
  attentionItems({ ...quiet, liveTutors: 0 }).some((i) => i.id === 'tutors'));
check('a risk floor item per market, linking to that market', () => {
  const floor = busy.find((i) => i.id === 'floor-adults');
  return Boolean(floor) && floor!.href === '/admin/markets/adults' && floor!.title === '5 fields below the risk floor of Adults: life & career';
});
check('without the market check (the header badge) there is no floor item', () =>
  !attentionItems({ ...quiet, belowRiskFloor: null }).some((i) => i.id.startsWith('floor-')));
check('every item links into the admin', () => busy.every((i) => i.href.startsWith('/admin')));
check('bots holding another type link to the browser filtered to them', () => busy.find((i) => i.id === 'bots-other-type')!.href === '/admin/taxonomy?groups=other-type');

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll attention checks passed.');
