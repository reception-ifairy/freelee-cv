/**
 * Checks the taxonomy browser's state and tree (src/lib/taxonomy/browser.ts):
 * the tree adds up, the URL is read safely (unknown ids dropped, a sector
 * brings its category), tree links keep a search but reset paging and close
 * the card, and Previous/Next stay on the page. No network, no database.
 *
 *   npx tsx scripts/verify-taxonomy-browser.ts
 */
import {
  buildTree, neighbours, parseBrowser, parseOpen, selectionHref, withOpen, PERSONA_LIST, SECTOR_LIST, type CountRow,
} from '../src/lib/taxonomy/browser';

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

const categories = [
  { id: 34, name: 'Education and Training', slug: 'education-and-training', color: '#0ea5e9', isActive: true, riskLevel: 'R2' },
  { id: 7, name: 'Health', slug: 'health', color: null, isActive: true, riskLevel: 'R3' },
];
const sectors = [
  { id: 42, categoryId: 34, name: 'Early Years', isActive: true, riskLevel: 'R2' },
  { id: 43, categoryId: 34, name: 'Tutoring', isActive: false, riskLevel: 'R1' },
  { id: 70, categoryId: 7, name: 'Nutrition', isActive: true, riskLevel: 'R2' },
];
// As the GROUPING SETS query returns them: 5 personas in Education (3 in Early Years, 1 unfiled
// within it, 1 in Tutoring), none in Health, 1 with no category; 4 live overall.
const counts: CountRow[] = [
  { level: 'pair', categoryId: 34, sectorId: 42, total: 3, live: 2 },
  { level: 'pair', categoryId: 34, sectorId: 43, total: 1, live: 1 },
  { level: 'pair', categoryId: 34, sectorId: null, total: 1, live: 0 },
  { level: 'pair', categoryId: null, sectorId: null, total: 1, live: 1 },
  { level: 'category', categoryId: 34, sectorId: null, total: 5, live: 3 },
  { level: 'category', categoryId: null, sectorId: null, total: 1, live: 1 },
  { level: 'all', categoryId: null, sectorId: null, total: 6, live: 4 },
];
const tree = buildTree(categories, sectors, counts);

console.log('Tree');
check('categories carry their counts; one with no personas reads 0/0', () =>
  expect([tree.categories[0].total, tree.categories[0].live, tree.categories[1].total], [5, 3, 0]));
check('sectors carry theirs, and personas in a category but no sector are counted apart', () =>
  expect([tree.categories[0].sectors.map((s) => `${s.live}/${s.total}`), tree.categories[0].unfiled], [['2/3', '1/1'], { total: 1, live: 0 }]));
check('a category adds up: its sectors plus its unfiled', () => {
  const c = tree.categories[0];
  return c.sectors.reduce((n, s) => n + s.total, 0) + c.unfiled.total === c.total;
});
check('overall and "no category" counts', () => expect([tree.all, tree.uncategorised, tree.sectorCount], [{ total: 6, live: 4 }, { total: 1, live: 1 }, 3]));

console.log('Reading the URL');
const at = (q: Record<string, string>) => parseBrowser(q, tree);
check('nothing selected: all categories, personas tab', () => expect(at({}).selection, { cat: null, sec: null, tab: 'personas' }));
check('a sector brings its own category, even when cat disagrees', () => expect(at({ cat: '7', sec: '42' }).selection, { cat: 34, sec: 42, tab: 'personas' }));
check('unknown category and sector ids are dropped, not passed to SQL', () => expect(at({ cat: '999', sec: 'x' }).selection, { cat: null, sec: null, tab: 'personas' }));
check('cat=none is understood', () => at({ cat: 'none' }).selection.cat === 'none');
check('the sectors tab only above sector level, never for "no category"', () =>
  at({ cat: '34', tab: 'sectors' }).selection.tab === 'sectors' && at({ sec: '42', tab: 'sectors' }).selection.tab === 'personas' && at({ cat: 'none', tab: 'sectors' }).selection.tab === 'personas');
check('each tab gets its own list config', () => at({ tab: 'sectors' }).config === SECTOR_LIST && at({}).config === PERSONA_LIST);
check('kept params are rewritten from what was understood', () => expect(at({ cat: '7', sec: '42', tab: 'sectors' }).params.kept, { cat: '34', sec: '42' }));
check('open= reads persona-N and sector-N only', () =>
  expect([parseOpen('persona-12'), parseOpen('sector-3'), parseOpen('user-1'), parseOpen('persona-1;drop')], [{ kind: 'persona', id: 12 }, { kind: 'sector', id: 3 }, null, null]));

console.log('Links');
const s = at({ cat: '34', q: 'maths', status: 'live', page: '3', open: 'persona-5' });
check('a card link keeps the whole list state and adds open= last', () =>
  expect(withOpen(s.params, s.config, { kind: 'persona', id: 9 }), '/admin/taxonomy?q=maths&status=live&cat=34&page=3&open=persona-9'));
check('closing the card keeps the list where it was', () => expect(withOpen(s.params, s.config, null), '/admin/taxonomy?q=maths&status=live&cat=34&page=3'));
check('a tree link keeps search and filters, resets paging, closes the card', () =>
  expect(selectionHref(s.params, s.config, s.selection, { cat: 7 }), '/admin/taxonomy?q=maths&status=live&cat=7'));
check('a sector link sets sec beside its category', () => expect(selectionHref(s.params, s.config, s.selection, { sec: 42 }), '/admin/taxonomy?q=maths&status=live&cat=34&sec=42'));
check('"All categories" clears the selection', () => expect(selectionHref(s.params, s.config, s.selection, { cat: null }), '/admin/taxonomy?q=maths&status=live'));
check('switching to the sectors tab keeps the search, drops persona filters', () =>
  expect(selectionHref(s.params, s.config, s.selection, { tab: 'sectors' }), '/admin/taxonomy?q=maths&cat=34&tab=sectors'));
const sec = at({ cat: '34', tab: 'sectors', sort: 'personas' });
check('from the sectors tab, a sector link goes back to personas, with persona defaults', () =>
  expect(selectionHref(sec.params, sec.config, sec.selection, { sec: 43 }), '/admin/taxonomy?cat=34&sec=43'));

console.log('A category is a pillar: its own tabs');
const edu = at({ cat: 'education-and-training', tab: 'tutors' });
check('a category can be picked by slug, and the URL keeps its id', () =>
  edu.selection.cat === 34 && expect(withOpen(edu.params, edu.config, null), '/admin/taxonomy?cat=34&tab=tutors'));
check('a category’s own tabs need one picked category, not a sector or the top level', () =>
  at({ cat: '34', tab: 'agent' }).selection.tab === 'agent' && at({ sec: '42', tab: 'agent' }).selection.tab === 'personas' && at({ tab: 'brief' }).selection.tab === 'personas');
check('the hub tabs only for the category that carries the hub', () =>
  at({ cat: '34', tab: 'families' }).selection.tab === 'families' && at({ cat: '7', tab: 'families' }).selection.tab === 'personas');
check('from a category tab, "All categories" goes back to the bot list', () =>
  expect(selectionHref(edu.params, edu.config, edu.selection, { cat: null }), '/admin/taxonomy'));
check('moving to another category keeps the tab it was on', () =>
  expect(selectionHref(at({ cat: '34', tab: 'audiences' }).params, at({ cat: '34', tab: 'audiences' }).config, at({ cat: '34', tab: 'audiences' }).selection, { cat: 7 }), '/admin/taxonomy?cat=7&tab=audiences'));

console.log('Previous / Next');
check('in the middle, both; at the ends, one; not on the page, none', () => {
  const rows = ['a', 'b', 'c'];
  return expect([neighbours(rows, 1), neighbours(rows, 0), neighbours(rows, 2), neighbours(rows, -1)], [
    { previous: 'a', next: 'c' }, { previous: null, next: 'b' }, { previous: 'b', next: null }, { previous: null, next: null },
  ]);
});

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll taxonomy-browser checks passed.');
