'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { AdminNav } from './admin-nav';
import { useMountTransition } from '@/components/ui/use-mount-transition';
import { Logo } from '@/components/site/logo';
import { cn } from '@/lib/utils';

/**
 * The admin navigation on a phone.
 *
 * There was none. The sidebar is `hidden lg:block`, and nothing else rendered
 * the nav — so below 1024px the entire admin console had one text link back to
 * the dashboard and no way to reach any other screen. This is new capability,
 * not a restyle.
 *
 * A drawer rather than a collapsing sidebar: 23 links do not fit above the
 * fold on a phone whatever you do with them, so the honest options are a
 * scrollable overlay or a separate mobile IA, and an overlay keeps one nav to
 * maintain.
 */
export function AdminDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { mounted, closing } = useMountTransition(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Navigating is the whole point of the drawer, so it closes itself on
  // arrival rather than leaving the destination hidden behind it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    // Scroll-lock, same reasoning as Modal: a drawer over a page that still
    // scrolls underneath feels broken on touch.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="grid size-9 shrink-0 place-items-center rounded-control text-slate-400 transition hover:bg-white/5 hover:text-slate-200 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/*
        Rendered into <body>, not in place.

        The trigger lives inside the sticky admin header, which carries
        `backdrop-blur`. A `backdrop-filter` makes an element a **containing
        block for fixed-position descendants**, so `fixed inset-0` sized itself
        to the 64px-tall header rather than the viewport and the drawer
        collapsed to just its own header row. A portal escapes that entirely,
        and is the right answer regardless: an overlay belongs at the top of
        the stacking context, not nested in whatever happened to trigger it.
      */}
      {mounted
        ? createPortal(
        <div className={cn('fixed inset-0 z-150 lg:hidden', closing ? 'animate-fade-out' : 'animate-fade-in')}>
          {/* Sibling, not wrapper — a backdrop containing the panel swallows
              clicks meant for the links. */}
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-slate-900/70 backdrop-blur-sm"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            tabIndex={-1}
            className={cn(
              'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-black outline-none',
              closing ? 'animate-drawer-out' : 'animate-drawer-in',
            )}
          >
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-5">
              <span className="glow-ring flex size-9 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-950/50">
                <Logo className="size-5" />
              </span>
              <span className="font-bold tracking-tight">Freelee</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="ml-auto grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <AdminNav onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
