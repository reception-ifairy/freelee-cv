/**
 * Checks the admin navigation against the admin pages that actually exist:
 * every admin page has exactly one current sidebar item and a breadcrumb
 * (none is ever blank, as category and sector editors were until 2026-11-14),
 * sidebar hrefs are unique and lead to pages, and the admin links declared in
 * the module registry lead to pages too. No network, no database.
 *
 *   npx tsx scripts/verify-admin-nav.ts
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_NAV, CATEGORY_GROUP_ID, DEFAULT_OPEN_GROUPS, adoptedHref, categoryNavSection, findActiveNavItem, findNavItemByHref, groupOfPath,
  hrefPath, isCategoryItemCurrent, isNavItemCurrent, isNavItemCurrentAt, parseOpenGroups,
} from '../src/lib/admin/nav';
import { MODULES } from '../src/lib/modules/registry';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'admin');

/** Every admin page as a concrete path: "[id]" becomes "1", an optional catch-all disappears. */
function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (name === 'page.tsx') {
      const segments = relative(ROOT, dir).split(sep).filter(Boolean)
        .filter((s) => !/^\(.*\)$/.test(s))
        .flatMap((s) => (/^\[\[\.\.\..+\]\]$/.test(s) ? [] : /^\[.+\]$/.test(s) ? ['1'] : [s]));
      out.push(['/admin', ...segments].join('/'));
    }
  }
  return out.sort();
}

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

/** Every admin page as a pattern: "[id]" matches any one segment, an optional catch-all anything below. */
function patterns(dir: string): RegExp[] {
  const out: RegExp[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...patterns(full));
    else if (name === 'page.tsx') {
      const segments = relative(ROOT, dir).split(sep).filter(Boolean).filter((s) => !/^\(.*\)$/.test(s));
      const body = segments
        .map((s) => (/^\[\[\.\.\..+\]\]$/.test(s) ? '(?:/.*)?' : /^\[.+\]$/.test(s) ? '/[^/]+' : `/${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
        .join('');
      out.push(new RegExp(`^/admin${body}$`));
    }
  }
  return out;
}

// Concrete paths, plus the retired markets by name: [pillar] is not a number.
const routes = [...pages(ROOT), '/admin/markets/homeschooling'].sort();
const routePatterns = patterns(ROOT);
const isPage = (href: string) => routePatterns.some((re) => re.test(href));
const items = ADMIN_NAV.flatMap((s) => s.items);

console.log('Admin navigation');
check(`${routes.length} admin pages found`, () => routes.length > 40 || `only ${routes.length}`);
check('every admin page has exactly one current sidebar item', () => {
  const bad = routes.map((p) => [p, items.filter((i) => isNavItemCurrent(i, p)).length] as const).filter(([, n]) => n !== 1);
  return bad.length === 0 || bad.map(([p, n]) => `${p} (${n})`).join(', ');
});
check('every admin page has a breadcrumb (its own item, or the item that adopts it)', () => {
  const blank = routes.filter((p) => {
    const adopted = adoptedHref(p);
    return !(adopted ? findNavItemByHref(adopted) : findActiveNavItem(p));
  });
  return blank.length === 0 || blank.join(', ');
});
check('sidebar hrefs are unique', () => {
  const hrefs = items.map((i) => i.href);
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  return dupes.length === 0 || dupes.join(', ');
});
check('every sidebar href is a page', () => {
  // A query is a filter on that page (Drafts = the taxonomy browser with status=draft).
  const missing = items.map((i) => i.href).filter((h) => !isPage(hrefPath(h)));
  return missing.length === 0 || missing.join(', ');
});
check('every admin link in the module registry is a page', () => {
  const links = MODULES.flatMap((m) => (m.navigation ?? []).filter((n) => n.group === 'admin').map((n) => n.href));
  const missing = links.filter((h) => !isPage(hrefPath(h)));
  return missing.length === 0 || missing.join(', ');
});
check('the old Prototypes and Drafts addresses still exist (they redirect to the browser’s drafts)', () =>
  routes.includes('/admin/taxonomy/prototypes') && routes.includes('/admin/taxonomy/drafts') && items.some((i) => i.href === '/admin/taxonomy?status=draft'));
check('Drafts is current on the browser with status=draft, and then Bots & taxonomy is not', () => {
  const drafts = items.find((i) => i.label === 'Drafts')!;
  const bots = items.find((i) => i.href === '/admin/taxonomy')!;
  const at = (q: string) => new URLSearchParams(q);
  return (
    isNavItemCurrentAt(drafts, '/admin/taxonomy', at('status=draft')) &&
    !isNavItemCurrentAt(bots, '/admin/taxonomy', at('status=draft')) &&
    isNavItemCurrentAt(bots, '/admin/taxonomy', at('status=live')) &&
    !isNavItemCurrentAt(drafts, '/admin/taxonomy', at(''))
  );
});
check('the old bots list and a bot’s editor belong to Bots & taxonomy', () =>
  ['/admin/personas', '/admin/personas/1', '/admin/personas/new', '/admin/personas/convert'].every((p) => adoptedHref(p) === '/admin/taxonomy'));

console.log('Groups');
check('group ids are unique, and every group but the first has a heading', () => {
  const ids = ADMIN_NAV.map((s) => s.id);
  return new Set(ids).size === ids.length && ADMIN_NAV.slice(1).every((s) => s.heading) && ADMIN_NAV.every((s) => s.items.length > 0);
});
check('the default open groups exist (the categories group is built at request time)', () =>
  DEFAULT_OPEN_GROUPS.every((id) => id === CATEGORY_GROUP_ID || ADMIN_NAV.some((s) => s.id === id)));
check('the cookie: missing means defaults, empty means all folded, unknown ids are dropped', () =>
  JSON.stringify([parseOpenGroups(undefined), parseOpenGroups(''), parseOpenGroups('site,nonsense, categories')]) ===
  JSON.stringify([DEFAULT_OPEN_GROUPS, [], ['site', 'categories']]));
check('every page belongs to exactly the group of its current item (that group is always open)', () => {
  const want: Record<string, string> = {
    '/admin': 'overview',
    '/admin/markets': 'catalogue',
    '/admin/markets/homeschooling': 'catalogue',
    '/admin/taxonomy/34': 'catalogue',
    '/admin/categories/5': 'catalogue',
    '/admin/taxonomy/audiences': 'catalogue',
    '/admin/translations': 'site',
    '/admin/ai-models': 'system',
    '/admin/crews/runs/abc': 'teamwork',
  };
  const wrong = Object.entries(want).filter(([path, group]) => groupOfPath(path) !== group);
  const orphans = routes.filter((path) => groupOfPath(path) === null);
  return (wrong.length === 0 && orphans.length === 0) || `wrong: ${wrong.map(([p]) => `${p}→${groupOfPath(p)}`).join(', ')}; orphans: ${orphans.join(', ')}`;
});
const catSection = categoryNavSection([
  { id: 34, slug: 'education-and-training', name: 'Education and Training', color: '#0ea5e9', live: 16, total: 32 },
  { id: 41, slug: 'health-and-medicine', name: 'Health and Medicine', color: null, live: 0, total: 0 },
]);
check('each category is an item: its colour, live/total, dimmed when empty, opening the browser', () =>
  catSection.items[0].href === '/admin/taxonomy?cat=34' && catSection.items[0].meta === '16/32' && !catSection.items[0].muted &&
  catSection.items[1].muted === true && catSection.items[1].dot === '#6366f1');
check('a category item is current on the browser with its cat, by id or by slug — and only there', () =>
  isCategoryItemCurrent(catSection.items[0], '/admin/taxonomy', '34') && isCategoryItemCurrent(catSection.items[0], '/admin/taxonomy', 'education-and-training') &&
  !isCategoryItemCurrent(catSection.items[0], '/admin/taxonomy', '41') && !isCategoryItemCurrent(catSection.items[0], '/admin/personas', '34'));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll admin-navigation checks passed.');
