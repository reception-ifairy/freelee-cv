'use client';

import { useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMountTransition } from './use-mount-transition';
import { useDialog } from './use-dialog';
import { overlayRoot } from './overlay-root';

const noSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after. A sheet opened by the
 * URL is rendered by the server with `open` already true, and the portal
 * target (`document`) does not exist there; it appears one render later.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * A panel that slides in from the right over a list: the "card on demand" of
 * the admin browsers (owner, 2026-11-14 — "a list where a card opens when you
 * want it"). The list stays where it was behind it; closing puts focus back on
 * the row that opened it.
 *
 * Differs from Modal in three ways:
 * - it is anchored to the right edge and full height, so long content scrolls
 *   inside it while its header (title, Previous/Next, Open) stays put;
 * - it portals into the console's overlay root (see overlay-root.ts), so it
 *   escapes any `fixed`-trapping ancestor yet keeps the console's look;
 * - below `sm` it takes the whole screen — a 300px panel beside a 60px sliver
 *   of list is neither.
 *
 * Keys, focus and scroll lock come from useDialog. For a sheet whose state is
 * in the URL (`?open=…`), see RouteSheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  actions,
  footer,
  dirty = false,
  width = 'md',
  returnFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Next to the close button: Previous/Next, "Open" — kept visible while the body scrolls. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  dirty?: boolean;
  width?: 'md' | 'lg';
  /** See useDialog — where focus lands on close, if not on what opened it. */
  returnFocus?: () => HTMLElement | null;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { mounted, closing } = useMountTransition(open);
  const isClient = useIsClient();
  const shown = mounted && isClient;

  function requestClose() {
    if (dirty && !window.confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  }

  useDialog({ open: open && shown, onClose: requestClose, panelRef, returnFocus });

  if (!shown) return null;

  return createPortal(
    <div className={cn('fixed inset-0 z-[180]', closing ? 'animate-fade-out' : 'animate-fade-in')}>
      {/* Sibling, not wrapper — a backdrop containing the panel swallows its clicks. */}
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-slate-950/55"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl outline-none dark:border-white/10 dark:bg-slate-950',
          width === 'md' ? 'sm:max-w-xl' : 'sm:max-w-3xl',
          closing ? 'animate-drawer-right-out' : 'animate-drawer-right-in',
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
            <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close panel"
            title="Close (Esc)"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-200 dark:hover:bg-white/5"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    overlayRoot(),
  );
}
