'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createDialogStack, isTopDialog, popDialog, pushDialog } from './dialog-stack';

/** One stack for the whole tab: overlays from different components see each other. */
const stack = createDialogStack();
let savedOverflow = '';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What every overlay in the admin has to get right, in one place.
 *
 * Extracted from Modal, which was the only one that did all of it. The mobile
 * nav drawer had Escape but no Tab trap — Tab walked out of the drawer into the
 * page hidden behind it — and focus went back to the menu button only on
 * Escape, not when the drawer closed any other way.
 *
 * While `open`:
 * - focus moves to the panel (not its first control — a text input grabbing
 *   focus scrolls a long form to wherever that input is);
 * - Tab and Shift+Tab cycle inside the panel;
 * - Escape calls `onClose`, but only for the overlay on top (see dialog-stack);
 * - the page behind does not scroll while any overlay is open.
 * On close, focus returns to whatever had it before (or to `returnFocus()`).
 *
 * Pass `open` true only once the panel is in the DOM — with useMountTransition
 * that is `open && mounted` — or there is nothing to move focus into.
 *
 * `onClose` is read at key-press time, so callers may pass a fresh closure on
 * every render (one that checks a `dirty` flag, say) without re-running this.
 */
export function useDialog({
  open,
  onClose,
  panelRef,
  restoreFocus = true,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  /**
   * Where focus goes on close, if not back to what had it on open — read at
   * close time. A sheet stepped from row A to row E with Next should land on
   * E's row, not A's.
   */
  returnFocus?: () => HTMLElement | null;
}) {
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusRef.current = returnFocus;
  });

  useEffect(() => {
    if (!open) return;

    const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { id, first } = pushDialog(stack);
    if (first) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog(stack, id)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (event.key !== 'Tab' || !panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      // Focus can sit on the panel itself (it is focused on open) or, after a
      // click on padding, nowhere inside it at all; both count as "outside".
      const inside = active instanceof Node && panel.contains(active) && active !== panel;
      if (event.shiftKey && (active === firstEl || !inside)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (active === lastEl || !inside)) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (popDialog(stack, id).last) document.body.style.overflow = savedOverflow;
      if (!restoreFocus) return;
      const target = returnFocusRef.current?.() ?? returnFocusTo;
      if (target?.isConnected) target.focus();
    };
  }, [open, panelRef, restoreFocus]);
}
