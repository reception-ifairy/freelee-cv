/**
 * Checks the URL state of admin lists (src/lib/admin/list-query.ts): `keep`
 * params survive every toolbar change (a tree selection beside a list used to
 * be dropped by the first search), defaults stay out of the URL, and sortable
 * column headers flip between their two sort ids. No network, no database.
 *
 *   npx tsx scripts/verify-list-query.ts
 */
import { hasActiveFilters, listHref, parseListParams, sortToggle, type ListConfig } from '../src/lib/admin/list-query';

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
const expect = (got: string, want: string) => got === want || `got ${got}, want ${want}`;

const config: ListConfig = {
  filters: [{ key: 'status', label: 'Status', options: [{ id: 'live', label: 'Live' }, { id: 'draft', label: 'Draft' }] }],
  sorts: [{ id: 'name', label: 'Name' }, { id: 'name-desc', label: 'Name Z–A' }, { id: 'newest', label: 'Newest' }],
  defaultSort: 'name',
  keep: ['cat', 'sec'],
};
const path = '/admin/taxonomy';

console.log('List query');
const p = parseListParams({ cat: '34', sec: ' 42 ', status: 'live', q: 'tutor', page: '3', open: 'persona-1' }, config);
check('kept params are read (trimmed); unknown ones (open) are not', () =>
  p.kept.cat === '34' && p.kept.sec === '42' && !('open' in p.kept));
check('a search keeps the tree selection and goes back to page 1', () =>
  expect(listHref(path, p, config, { q: 'maths', page: 1 }), '/admin/taxonomy?q=maths&status=live&cat=34&sec=42'));
check('"Clear all" (q and filters) still keeps the selection', () =>
  expect(listHref(path, p, config, { q: '', filters: { status: '' }, page: 1 }), '/admin/taxonomy?cat=34&sec=42'));
check('a tree link can change or drop a kept param', () =>
  expect(listHref(path, p, config, { kept: { cat: '7', sec: '' }, page: 1 }), '/admin/taxonomy?q=tutor&status=live&cat=7'));
check('kept params follow the order in config, page stays last', () =>
  expect(listHref(path, parseListParams({ sec: '42', cat: '34', page: '2' }, config), config), '/admin/taxonomy?cat=34&sec=42&page=2'));
check('a kept selection is not an "active filter"', () => !hasActiveFilters(parseListParams({ cat: '34' }, config)));
check('a list without keep behaves as before', () => {
  const plain = { ...config, keep: undefined };
  return expect(listHref(path, parseListParams({ cat: '34', q: 'x' }, plain), plain), '/admin/taxonomy?q=x');
});
check('an overlong kept value is cut to 100 characters', () => parseListParams({ cat: 'x'.repeat(300) }, config).kept.cat.length === 100);

console.log('Sortable columns');
const col = { asc: 'name', desc: 'name-desc' };
const byName = sortToggle(path, parseListParams({ cat: '34', page: '4' }, config), config, col);
check('sorted ascending by this column: says so, and links to descending (page 1, selection kept)', () =>
  byName.direction === 'asc' && expect(byName.href, '/admin/taxonomy?sort=name-desc&cat=34'));
const desc = sortToggle(path, parseListParams({ sort: 'name-desc' }, config), config, col);
check('sorted descending: links back to ascending, the default, so no sort param', () =>
  desc.direction === 'desc' && expect(desc.href, '/admin/taxonomy'));
const other = sortToggle(path, parseListParams({ sort: 'newest' }, config), config, col);
check('sorted by another column: no direction, links to ascending', () => other.direction === null && expect(other.href, '/admin/taxonomy'));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll list-query checks passed.');
