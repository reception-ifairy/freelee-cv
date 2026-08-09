'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { BlockIcon } from '@/components/ui/block-icon';
import { cn } from '@/lib/utils';

export type NavChild = {
  id: number;
  label: string;
  href: string;
  description: string | null;
  icon: string | null;
  openInNewTab: boolean;
};

/**
 * A navigation dropdown, hand-written rather than pulled from a library.
 *
 * The same posture as `GridSelect` and `HelpTip`: this codebase has no Radix or
 * Headless UI, and one small menu does not justify introducing one. (@dnd-kit
 * was added for the builder because accessible drag-and-drop genuinely is hard;
 * a disclosure menu is not.)
 *
 * What it has to get right, and does:
 *  - **Hover and click.** Hover alone excludes touch users entirely.
 *  - **Escape closes** and returns focus to the trigger.
 *  - **Arrow keys** move through the items; Home/End jump to the ends.
 *  - **Outside click and focus leaving** both close it.
 *  - A **close delay** on mouse-out, so a diagonal move from the trigger to the
 *    panel does not slam it shut mid-gesture.
 */
export function NavDropdown({ label, children }: { label: string; children: NavChild[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function focusItem(index: number) {
    const items = rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-nav-item]');
    if (!items || items.length === 0) return;
    const clamped = (index + items.length) % items.length;
    items[clamped]?.focus();
  }

  function onPanelKeyDown(event: React.KeyboardEvent) {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-nav-item]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      // Closing on focus leaving is what makes Tab out of the last item behave
      // the same as clicking away.
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            // Wait for the panel to exist before reaching into it.
            requestAnimationFrame(() => focusItem(0));
          }
        }}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {label}
        <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          id={panelId}
          onKeyDown={onPanelKeyDown}
          className="absolute left-0 top-full z-50 mt-1 min-w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {children.map((child) => (
            <Link
              key={child.id}
              href={child.href}
              data-nav-item
              target={child.openInNewTab ? '_blank' : undefined}
              rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
            >
              {child.icon ? (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <BlockIcon name={child.icon} className="size-3.5" />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{child.label}</span>
                {child.description ? (
                  <span className="block text-xs text-slate-400">{child.description}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
