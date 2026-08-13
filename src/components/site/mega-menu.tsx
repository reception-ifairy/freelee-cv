'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { NavSection, NavLink } from '@/lib/site/nav';
import { NavIcon } from './nav-icon';
import { cn } from '@/lib/utils';

/**
 * The visitor-facing desktop navigation.
 *
 * Hand-written for the same reason `NavDropdown` was: this codebase has no
 * Radix or Headless UI, and the accessible parts of a menu — Escape, arrow
 * keys, focus handling, hover intent — are a day's work, not a dependency.
 *
 * Three things make it feel like one menu rather than four:
 *
 *  1. **A shared open state.** Moving from Personas to Platform swaps the panel
 *     without closing and reopening it, so the menu reads as one surface you
 *     are moving along rather than four that flicker.
 *  2. **Hover intent.** Opening is delayed slightly and closing more so; a
 *     diagonal move from a trigger to the panel below it crosses a sliver of
 *     dead space, and without the delay that slams the panel shut mid-gesture.
 *  3. **It is not hover-only.** Click works, keyboard works. Hover alone
 *     excludes touch and keyboard users from the whole navigation.
 */

const OPEN_DELAY = 80;
const CLOSE_DELAY = 180;

export function MegaMenu({ sections }: { sections: NavSection[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function scheduleOpen(label: string) {
    clearTimers();
    // Already open on a sibling: swap immediately. The delay exists to avoid
    // opening on a passing cursor, and the cursor is demonstrably not passing.
    if (openLabel) {
      setOpenLabel(label);
      return;
    }
    openTimer.current = setTimeout(() => setOpenLabel(label), OPEN_DELAY);
  }

  function scheduleClose() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenLabel(null), CLOSE_DELAY);
  }

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!openLabel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenLabel(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenLabel(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openLabel]);

  const active = sections.find((s) => s.kind === 'mega' && s.label === openLabel);

  return (
    <div
      ref={rootRef}
      className="relative hidden lg:flex lg:items-center"
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpenLabel(null);
      }}
    >
      <nav className="flex items-center gap-0.5" aria-label="Main">
        {sections.map((section) =>
          section.kind === 'link' ? (
            <Link
              key={section.label}
              href={section.href}
              onMouseEnter={scheduleClose}
              className="focus-ring rounded-control px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-[--duration-fast] hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {section.label}
            </Link>
          ) : (
            <button
              key={section.label}
              type="button"
              aria-expanded={openLabel === section.label}
              aria-haspopup="true"
              onMouseEnter={() => scheduleOpen(section.label)}
              onClick={() => {
                clearTimers();
                setOpenLabel(openLabel === section.label ? null : section.label);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setOpenLabel(section.label);
                }
              }}
              className={cn(
                'focus-ring flex items-center gap-1 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-[--duration-fast]',
                openLabel === section.label
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
              )}
            >
              {section.label}
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-[--duration-base] ease-[--ease-out]',
                  openLabel === section.label && 'rotate-180',
                )}
              />
            </button>
          ),
        )}
      </nav>

      {active && active.kind === 'mega' ? (
        <div
          // Anchored to the nav's left edge rather than to the trigger: a panel
          // that jumps sideways as you move between triggers draws attention to
          // the chrome instead of the content.
          className="absolute left-0 top-full z-50 pt-2"
          onMouseEnter={clearTimers}
        >
          <div
            // `key` restarts the entrance on every swap, so moving between
            // triggers re-animates the contents rather than silently replacing
            // them under a static frame.
            key={active.label}
            className="surface-overlay animate-mega-in w-[min(60rem,calc(100vw-3rem))] overflow-hidden p-2"
          >
            <div className={cn('grid gap-2', active.feature ? 'lg:grid-cols-[1fr_1fr_18rem]' : 'lg:grid-cols-2')}>
              {active.columns.map((column) => (
                <div key={column.heading} className="p-3">
                  <p className="eyebrow mb-3 px-2">{column.heading}</p>
                  <ul className="space-y-0.5">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <MegaLink link={link} onNavigate={() => setOpenLabel(null)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {active.feature ? (
                <Link
                  href={active.feature.href}
                  onClick={() => setOpenLabel(null)}
                  className="focus-ring group relative flex flex-col justify-between gap-4 overflow-hidden rounded-card border border-brand-500/20 bg-brand-500/[0.06] p-5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/[0.1]"
                >
                  <div>
                    <span className="mb-3 inline-grid size-9 place-items-center rounded-xl bg-brand-500/15 text-brand-500 dark:text-brand-400">
                      <NavIcon name={active.feature.icon} className="size-4" />
                    </span>
                    <p className="eyebrow">{active.feature.eyebrow}</p>
                    <p className="mt-1.5 font-semibold tracking-tight">{active.feature.title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {active.feature.body}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {active.feature.cta}
                    <ArrowRight className="size-3.5 transition-transform duration-[--duration-base] group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MegaLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const content = (
    <>
      {link.icon ? (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200/80 bg-white/60 text-slate-500 transition-colors group-hover:border-brand-500/30 group-hover:bg-brand-500/10 group-hover:text-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:group-hover:text-brand-400">
          <NavIcon name={link.icon} className="size-4" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {link.label}
          {link.tag ? (
            <span className="rounded-full border border-slate-200/80 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/15 dark:text-slate-400">
              {link.tag}
            </span>
          ) : null}
        </span>
        {link.description ? (
          <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
            {link.description}
          </span>
        ) : null}
      </span>
    </>
  );

  // A placeholder is shown but not clickable. A nav link that goes nowhere is
  // worse than one that says "Soon" — it costs a click and a page load to
  // discover the thing does not exist.
  if (link.placeholder) {
    return (
      <span
        aria-disabled
        className="group flex cursor-default items-start gap-3 rounded-control px-2 py-2 opacity-55"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="focus-ring group flex items-start gap-3 rounded-control px-2 py-2 transition-colors duration-[--duration-fast] hover:bg-slate-100/70 dark:hover:bg-white/[0.06]"
    >
      {content}
    </Link>
  );
}
