/**
 * Which overlay is on top, and whether the page behind may scroll.
 *
 * Kept free of React and the DOM so `scripts/verify-dialog-stack.ts` can check
 * it directly. Two overlays can be open at once now — a Sheet with a Modal
 * opened from inside it, or a confirm over a Sheet — and both used to listen
 * for Escape on `document`, so one key press closed everything. And each
 * restored `body.style.overflow` on close, so closing the inner one unlocked
 * scrolling while the outer one was still open.
 *
 * The rule: only the most recently opened overlay answers keys, and the page
 * is locked while any overlay is open.
 */
export type DialogStack = { ids: number[]; next: number };

export function createDialogStack(): DialogStack {
  return { ids: [], next: 1 };
}

/** Registers an overlay; returns its id and whether it is the first (lock the page). */
export function pushDialog(stack: DialogStack): { id: number; first: boolean } {
  const id = stack.next++;
  stack.ids.push(id);
  return { id, first: stack.ids.length === 1 };
}

/** Removes an overlay wherever it sits; returns whether none is left (unlock the page). */
export function popDialog(stack: DialogStack, id: number): { last: boolean } {
  const at = stack.ids.indexOf(id);
  if (at !== -1) stack.ids.splice(at, 1);
  return { last: stack.ids.length === 0 };
}

export function isTopDialog(stack: DialogStack, id: number): boolean {
  return stack.ids.length > 0 && stack.ids[stack.ids.length - 1] === id;
}
