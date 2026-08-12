'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActionItem = {
  label: string;
  /** A link action. Mutually exclusive with `onSelect`. */
  href?: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  /** Red styling and a confirmation step. */
  danger?: boolean;
  disabled?: boolean;
  /** Draws a rule above this item, to separate destructive actions from routine ones. */
  separated?: boolean;
};

/**
 * The `⋯` menu used across the admin.
 *
 * Replaces the loose rows of icon buttons that every list page used to carry:
 * three or four unlabelled icons per row, each a guess. Here every action has a
 * written label, and destructive ones are visually separated and ask before
 * firing.
 *
 * Hand-written, like `GridSelect`, `HelpTip` and `NavDropdown` — this codebase
 * has no Radix, and a menu does not justify one. Keyboard support matches
 * `NavDropdown`: Escape closes and restores focus, arrows move, Home/End jump.
 */
export function ActionMenu({ items, label = 'Actions', align = 'right' }: { items: ActionItem[]; label?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const usable = items.filter((item) => !item.disabled);

  useEffect(() => {
    if (!open) {
      setConfirming(null);
      return;
    }

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
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[data-action-item]');
    if (!nodes || nodes.length === 0) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  }

  function onPanelKeyDown(event: React.KeyboardEvent) {
    const nodes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-action-item]') ?? []);
    const current = nodes.indexOf(document.activeElement as HTMLElement);

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
      focusItem(nodes.length - 1);
    }
  }

  if (usable.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          // Cards are often wrapped in a link; without this the menu button
          // navigates instead of opening.
          event.preventDefault();
          event.stopPropagation();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => focusItem(0));
        }}
        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          onKeyDown={onPanelKeyDown}
          className={cn(
            'animate-slide-up absolute top-full z-50 mt-1 min-w-48 rounded-control border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {usable.map((item, index) => {
            const isConfirming = confirming === item.label;
            const classes = cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none',
              item.danger
                ? 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:focus:bg-rose-500/10'
                : 'hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800',
            );

            const content = (
              <>
                {item.icon}
                {isConfirming ? 'Really delete?' : item.label}
              </>
            );

            return (
              <div key={item.label}>
                {item.separated && index > 0 ? <div className="my-1 border-t border-slate-100 dark:border-slate-800" /> : null}
                {item.href ? (
                  <Link href={item.href} data-action-item role="menuitem" className={classes} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    data-action-item
                    role="menuitem"
                    className={classes}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      // Destructive actions take two clicks. The old inline bin
                      // icon fired on the first, with nothing to undo it.
                      if (item.danger && !isConfirming) {
                        setConfirming(item.label);
                        return;
                      }
                      item.onSelect?.();
                      setOpen(false);
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
