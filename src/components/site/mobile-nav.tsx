'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import type { NavSection, NavLink } from '@/lib/site/nav';
import { useMountTransition } from '@/components/ui/use-mount-transition';
import { NavIcon } from './nav-icon';
import { cn } from '@/lib/utils';

/**
 * The public site's navigation on a phone.
 *
 * There was none. The header's `<nav>` is `hidden lg:flex` and nothing else
 * rendered it, so below 1024px — which is most visitors — the site had a logo,
 * a theme toggle and a Get started button, and no way to reach personas,
 * pricing or the blog at all.
 *
 * The panels become **accordions** rather than a shrunk-down mega menu. A
 * hover-driven three-column panel has no meaning on a touch screen, and
 * reorganising for the smaller screen is the whole point of doing it properly
 * instead of scaling the desktop version down.
 */
export function MobileNav({
  sections,
  signedIn,
  signInLabel,
  getStartedLabel,
}: {
  sections: NavSection[];
  signedIn: boolean;
  signInLabel: string;
  getStartedLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();
  const { mounted, closing } = useMountTransition(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Arriving is the point of the menu, so it gets out of the way on arrival.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="focus-ring grid size-10 place-items-center rounded-control text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Portalled: the site header is `sticky` with `backdrop-blur`, and a
          backdrop-filter makes an element a containing block for fixed
          descendants — an overlay rendered inside it would size itself to the
          64px header rather than the viewport. */}
      {mounted
        ? createPortal(
            <div className={cn('fixed inset-0 z-[100] lg:hidden', closing ? 'animate-fade-out' : 'animate-fade-in')}>
              <button
                type="button"
                aria-label="Close menu"
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="absolute inset-0 cursor-default bg-slate-900/60 backdrop-blur-sm"
              />

              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Site menu"
                tabIndex={-1}
                className={cn(
                  'absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col border-l border-slate-200 bg-white outline-none dark:border-white/10 dark:bg-black',
                  closing ? 'animate-drawer-right-out' : 'animate-drawer-right-in',
                )}
              >
                <div className="flex h-16 shrink-0 items-center justify-between border-b hairline px-5">
                  <span className="eyebrow">Menu</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="focus-ring grid size-9 place-items-center rounded-control text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {sections.map((section) =>
                    section.kind === 'link' ? (
                      <Link
                        key={section.label}
                        href={section.href}
                        className="focus-ring block rounded-control px-3 py-3 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                      >
                        {section.label}
                      </Link>
                    ) : (
                      <div key={section.label}>
                        <button
                          type="button"
                          aria-expanded={expanded === section.label}
                          onClick={() => setExpanded(expanded === section.label ? null : section.label)}
                          className="focus-ring flex w-full items-center justify-between rounded-control px-3 py-3 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          {section.label}
                          <ChevronDown
                            className={cn(
                              'size-4 text-slate-400 transition-transform duration-[--duration-base]',
                              expanded === section.label && 'rotate-180',
                            )}
                          />
                        </button>

                        {expanded === section.label ? (
                          <div className="animate-slide-up space-y-3 pb-2 pl-3">
                            {section.columns.map((column) => (
                              <div key={column.heading}>
                                <p className="eyebrow px-3 py-1.5">{column.heading}</p>
                                {column.links.map((link) => (
                                  <MobileLink key={link.label} link={link} />
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>

                {/* The two actions that matter to a visitor stay pinned, so
                    they never require scrolling past an open accordion. */}
                {!signedIn ? (
                  <div className="shrink-0 space-y-2 border-t hairline p-4">
                    <Link
                      href="/register"
                      className="focus-ring flex h-11 items-center justify-center rounded-control bg-brand-600 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
                    >
                      {getStartedLabel}
                    </Link>
                    <Link
                      href="/login"
                      className="focus-ring flex h-11 items-center justify-center rounded-control border hairline text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    >
                      {signInLabel}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MobileLink({ link }: { link: NavLink }) {
  const inner = (
    <>
      {link.icon ? <NavIcon name={link.icon} className="size-4 shrink-0 text-slate-400" /> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {link.label}
          {link.tag ? (
            <span className="rounded-full border hairline px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {link.tag}
            </span>
          ) : null}
        </span>
        {link.description ? (
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{link.description}</span>
        ) : null}
      </span>
    </>
  );

  if (link.placeholder) {
    return (
      <span aria-disabled className="flex cursor-default items-start gap-3 px-3 py-2.5 opacity-55">
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={link.href}
      className="focus-ring flex items-start gap-3 rounded-control px-3 py-2.5 transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
    >
      {inner}
    </Link>
  );
}
