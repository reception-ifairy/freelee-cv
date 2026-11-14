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
import { ADMIN_NAV, adoptedHref, findActiveNavItem, findNavItemByHref, isNavItemCurrent } from '../src/lib/admin/nav';
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

const routes = pages(ROOT);
const items = ADMIN_NAV.flatMap((s) => s.items);
const pattern = (href: string) => href.replace(/\/\d+(?=\/|$)/g, '/1');

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
  const missing = items.map((i) => i.href).filter((h) => !routes.includes(pattern(h)));
  return missing.length === 0 || missing.join(', ');
});
check('every admin link in the module registry is a page', () => {
  const links = MODULES.flatMap((m) => (m.navigation ?? []).filter((n) => n.group === 'admin').map((n) => n.href));
  const missing = links.filter((h) => !routes.includes(pattern(h)));
  return missing.length === 0 || missing.join(', ');
});
check('the old Prototypes address still exists (it redirects to Drafts)', () => routes.includes('/admin/taxonomy/prototypes') && items.some((i) => i.href === '/admin/taxonomy/drafts'));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll admin-navigation checks passed.');
