/**
 * Checks the overlay stack behind useDialog (src/components/ui/dialog-stack.ts):
 * with a Modal open over a Sheet only the top one answers Escape, and the page
 * stays locked until the last overlay closes, in whatever order they close.
 * Plus the wiring: Modal, Sheet and the admin drawer all use useDialog, and
 * the admin layout has the overlay root Sheet portals into. No network, no
 * database.
 *
 *   npx tsx scripts/verify-dialog-stack.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDialogStack, isTopDialog, popDialog, pushDialog } from '../src/components/ui/dialog-stack';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

let failed = 0;
function check(name: string, fn: () => boolean) {
  try {
    if (!fn()) throw new Error('returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log('Dialog stack');
{
  const stack = createDialogStack();
  const sheet = pushDialog(stack);
  const modal = pushDialog(stack);
  check('the first overlay locks the page, the second does not lock it again', () => sheet.first && !modal.first);
  check('with a Modal over a Sheet, only the Modal answers Escape', () => isTopDialog(stack, modal.id) && !isTopDialog(stack, sheet.id));
  check('closing the Modal leaves the page locked and hands keys back to the Sheet', () =>
    !popDialog(stack, modal.id).last && isTopDialog(stack, sheet.id));
  check('closing the Sheet unlocks the page', () => popDialog(stack, sheet.id).last && stack.ids.length === 0);
}
{
  const stack = createDialogStack();
  const a = pushDialog(stack);
  const b = pushDialog(stack);
  check('closed out of order (the lower one first), the page stays locked and the top keeps the keys', () =>
    !popDialog(stack, a.id).last && isTopDialog(stack, b.id));
  check('closing an overlay twice is harmless', () => popDialog(stack, b.id).last && popDialog(stack, b.id).last && !isTopDialog(stack, b.id));
}

console.log('Wiring');
check('Modal, Sheet and the admin drawer use useDialog, gated on being mounted', () =>
  ['src/components/ui/modal.tsx', 'src/components/ui/sheet.tsx', 'src/components/admin/admin-drawer.tsx'].every((f) =>
    /useDialog\(\{ open: open && (mounted|shown),/.test(read(f))));
check('the admin layout renders the overlay root, outside the header', () => {
  const layout = read('src/app/admin/layout.tsx');
  const root = layout.indexOf('<div id={ADMIN_OVERLAY_ROOT_ID} />');
  return root > layout.indexOf('</header>') && root > layout.indexOf('</main>');
});
check('the drawer and Sheet portal to the overlay root, not <body>', () =>
  ['src/components/ui/sheet.tsx', 'src/components/admin/admin-drawer.tsx'].every((f) => read(f).includes('overlayRoot()') && !read(f).includes('document.body,')));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll dialog-stack checks passed.');
