/**
 * The header and the footer both render from `buildMenuTree`, so a mistake here
 * shows a signed-out visitor an admin-only link, or hides a whole column.
 * Run with `npx tsx scripts/verify-menu-tree.ts`.
 */
import { buildMenuTree, type MenuRow } from '@/lib/navigation/tree';

let id = 0;
const row = (over: Partial<MenuRow>): MenuRow => ({
  id: ++id,
  label: `item-${id}`,
  href: '/x',
  visibleTo: 'all',
  openInNewTab: false,
  isActive: true,
  position: 0,
  parentId: null,
  icon: null,
  description: null,
  ...over,
});

const guest = { signedIn: false, isAdmin: false };
const member = { signedIn: true, isAdmin: false };
const admin = { signedIn: true, isAdmin: true };

const checks: [string, boolean][] = [];
const check = (name: string, actual: unknown, expected: unknown) =>
  checks.push([name, JSON.stringify(actual) === JSON.stringify(expected)]);

// Ordering
const parent = row({ label: 'Parent', position: 1 });
const other = row({ label: 'Other', position: 0 });
check('top level sorts by position', buildMenuTree([parent, other], guest).map((n) => n.label), ['Other', 'Parent']);

// Children sort and attach
const c2 = row({ label: 'B', parentId: parent.id, position: 2 });
const c1 = row({ label: 'A', parentId: parent.id, position: 1 });
check(
  'children attach and sort',
  buildMenuTree([parent, c2, c1], guest).find((n) => n.label === 'Parent')?.children.map((c) => c.label),
  ['A', 'B'],
);

// Visibility
const adminOnly = row({ label: 'Admin', visibleTo: 'admin' });
check('admin-only hidden from guest', buildMenuTree([adminOnly], guest).length, 0);
check('admin-only hidden from member', buildMenuTree([adminOnly], member).length, 0);
check('admin-only shown to admin', buildMenuTree([adminOnly], admin).length, 1);

const guestOnly = row({ label: 'Guest', visibleTo: 'guest' });
check('guest-only shown to guest', buildMenuTree([guestOnly], guest).length, 1);
check('guest-only hidden once signed in', buildMenuTree([guestOnly], member).length, 0);

const authOnly = row({ label: 'Auth', visibleTo: 'auth' });
check('auth-only hidden from guest', buildMenuTree([authOnly], guest).length, 0);

const inactive = row({ label: 'Off', isActive: false });
check('inactive never renders', buildMenuTree([inactive], admin).length, 0);

// A child the viewer may not see must not leak through its parent.
const p2 = row({ label: 'P2' });
const hiddenChild = row({ label: 'Secret', parentId: p2.id, visibleTo: 'admin' });
check(
  'hidden child excluded from parent',
  buildMenuTree([p2, hiddenChild], guest).find((n) => n.label === 'P2')?.children.length,
  0,
);
check(
  'hidden child included for admin',
  buildMenuTree([p2, hiddenChild], admin).find((n) => n.label === 'P2')?.children.length,
  1,
);

// An orphan must not be promoted to the top level, where it would appear from nowhere.
const orphan = row({ label: 'Orphan', parentId: 9999 });
check('orphan is dropped, not promoted', buildMenuTree([orphan], admin).length, 0);

// A child of a hidden parent is an orphan too.
const hiddenParent = row({ label: 'HiddenParent', isActive: false });
const strandedChild = row({ label: 'Stranded', parentId: hiddenParent.id });
check('child of hidden parent is dropped', buildMenuTree([hiddenParent, strandedChild], admin).length, 0);

let pass = 0;
for (const [name, ok] of checks) {
  if (ok) pass++;
  console.log(ok ? 'ok  ' : 'FAIL', name);
}
console.log(`\n${pass}/${checks.length} passed`);
process.exit(pass === checks.length ? 0 : 1);
