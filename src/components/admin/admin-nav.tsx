'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  ADMIN_NAV, CATEGORY_GROUP_ID, NAV_GROUPS_COOKIE, TONE_CLASSES, categoryNavSection, groupOfPath, isCategoryItemCurrent,
  isNavItemCurrentAt, hrefPath, type AdminNavItem, type AdminNavSection, type NavCategory,
} from '@/lib/admin/nav';
import { cn } from '@/lib/utils';

/**
 * The admin sidebar links, grouped by job: Categories (the platform's pillars
 * since 2026-11-16, read from the database with their live/total bots),
 * Catalogue, Knowledge, Teamwork, Commerce, Site, System.
 *
 * A client component so it can read `usePathname`. The active treatment is
 * three signals at once, because one is fragile: a left rail (position), a
 * tinted background (area), and a full-strength icon (colour).
 *
 * Groups fold. Thirty-odd links do not fit a screen, and most visits use two
 * groups. Which groups are open is kept in a cookie (`admin_nav_open`), read by
 * the layout on the server, so the sidebar arrives already folded the way it
 * was left — no flash of every group opening and closing. The group of the
 * page you are on is always open: a sidebar hiding where you are is worse
 * than a long one.
 */
export function AdminNav({
  onNavigate,
  initialOpen,
  categories = [],
}: {
  onNavigate?: () => void;
  initialOpen: string[];
  categories?: readonly NavCategory[];
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const cat = search.get('cat');
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen));
  const sections = [ADMIN_NAV[0], categoryNavSection(categories), ...ADMIN_NAV.slice(1)];
  const categoryOpen = sections[1].items.some((item) => isCategoryItemCurrent(item, pathname, cat));
  // A picked category is the current page, not the Taxonomy item it is a view of.
  const current = categoryOpen ? CATEGORY_GROUP_ID : groupOfPath(pathname);
  const isCurrent = (item: AdminNavItem) =>
    // An open category is the more precise answer than the browser's own items.
    isNavItemCurrentAt(item, pathname, search) && !(categoryOpen && !item.category && hrefPath(item.href) === '/admin/taxonomy');

  function toggle(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
    // Path /admin: the choice is the admin's, nothing outside it needs the cookie.
    document.cookie = `${NAV_GROUPS_COOKIE}=${[...next].join(',')}; path=/admin; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Admin sections">
      {sections.map((section) => (
        <NavSection
          key={section.id}
          section={section}
          isCurrent={isCurrent}
          onNavigate={onNavigate}
          open={section.heading === null || section.id === current || open.has(section.id)}
          pinned={section.id === current}
          onToggle={() => toggle(section.id)}
        />
      ))}
    </nav>
  );
}

function NavSection({
  section,
  isCurrent,
  onNavigate,
  open,
  pinned,
  onToggle,
}: {
  section: AdminNavSection;
  isCurrent: (item: AdminNavItem) => boolean;
  onNavigate?: () => void;
  open: boolean;
  pinned: boolean;
  onToggle: () => void;
}) {
  const tone = TONE_CLASSES[section.tone];
  const listId = `admin-nav-${section.id}`;
  // Only categories with bots — twenty dots would say nothing.
  const dots = section.items.filter((item) => item.dot && !item.muted);

  return (
    <div>
      {section.heading ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          disabled={pinned}
          title={pinned ? 'The page you are on is in this group' : undefined}
          className="group mt-3 flex w-full items-center gap-1.5 rounded px-3 py-1 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors enabled:hover:text-slate-300 disabled:cursor-default"
        >
          <span className="flex-1">{section.heading}</span>
          {/* Folded, the categories still show their colours — the group says what is in it. */}
          {!open && dots.length ? (
            <span className="flex gap-0.5" aria-hidden>
              {dots.map((item) => (
                <span key={item.href} className={cn('size-1.5 rounded-full', item.muted && 'opacity-40')} style={{ backgroundColor: item.dot }} />
              ))}
            </span>
          ) : null}
          {pinned ? null : (
            <ChevronRight aria-hidden className={cn('size-3 transition-transform duration-[--duration-fast]', open && 'rotate-90')} />
          )}
        </button>
      ) : null}

      <div id={listId} hidden={!open}>
        {section.items.map((item) => {
          const active = isCurrent(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              title={item.muted ? `${item.label} — no bot yet` : item.meta ? `${item.label} — ${item.meta} bots live` : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-control px-3 py-1.5 font-medium transition-colors duration-[--duration-fast]',
                active ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200',
                item.muted && !active && 'text-slate-500',
              )}
            >
              {/* The rail sits inside the row rather than on its border so it
                  cannot shift the text by a pixel when it appears. */}
              {active ? <span className={cn('absolute inset-y-1.5 left-0 w-0.5 rounded-full', tone.rail)} aria-hidden /> : null}
              {item.dot ? (
                <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
                  <span className={cn('size-2 rounded-full', item.muted && 'opacity-50')} style={{ backgroundColor: item.dot }} />
                </span>
              ) : (
                <item.icon className={cn('size-4 shrink-0 transition-colors duration-[--duration-fast]', active ? tone.active : tone.idle)} />
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.meta ? <span className="shrink-0 font-mono text-[10px] text-slate-500">{item.meta}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
