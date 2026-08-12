'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMountTransition } from './use-mount-transition';

/**
 * A focus-trapping dialog, hand-written like the rest of the UI primitives here.
 *
 * What it has to get right: Escape closes, focus moves in on open and back to
 * whatever opened it on close, Tab cycles inside rather than wandering into the
 * page behind, and the background does not scroll.
 *
 * `dirty` guards against losing typed content — closing with unsaved changes
 * asks first. That matters most here, because this dialog sits on top of the
 * live page and a stray click on the backdrop is easy.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  footer,
  dirty = false,
  width = 'lg',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  footer?: React.ReactNode;
  dirty?: boolean;
  width?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const { mounted, closing } = useMountTransition(open);

  function requestClose() {
    if (dirty && !window.confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  }

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the panel itself rather than the first control: a text input
    // grabbing focus scrolls a long form to wherever that input happens to be.
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusTo.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestClose closes over `dirty`, which is read at call time
  }, [open, dirty]);

  // Stays mounted through the exit animation — see useMountTransition. The
  // dialog used to vanish in the frame the state flipped, so it faded in and
  // then disappeared, which reads as a glitch rather than a close.
  if (!mounted) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:p-8',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      {/* A sibling, not a wrapper: a backdrop that contains the panel swallows
          clicks meant for the panel unless every one is stopped. */}
      <button type="button" aria-label="Close" tabIndex={-1} onClick={requestClose} className="fixed inset-0 cursor-default" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-card border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900',
          closing ? 'animate-scale-out' : 'animate-scale-in',
          width === 'md' && 'max-w-lg',
          width === 'lg' && 'max-w-2xl',
          width === 'xl' && 'max-w-4xl',
        )}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{eyebrow}</p>
            ) : null}
            <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
