'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ADMIN_NAV_ALIASES, findActiveNavItem } from '@/lib/admin/nav';

/**
 * Where you are, in the header.
 *
 * The topbar previously held one mobile-only text link and the user's name,
 * leaving the right half empty and the left half saying nothing. On a detail
 * route — `/admin/personas/769/`, `/admin/pages/12/builder` — there was no
 * indication of which section you had descended into and no one-click way back
 * up to it.
 *
 * Deliberately shallow: section, then leaf. A full path crumb would mostly
 * repeat the sidebar, which is already showing the section highlighted.
 */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const match = findActiveNavItem(pathname);

  const alias = ADMIN_NAV_ALIASES[pathname];
  if (!match) {
    return alias ? <span className="truncate text-sm font-semibold">{alias}</span> : null;
  }

  const { item } = match;
  // Everything after the section's own href — `/769`, `/convert`,
  // `/12/builder` — tells us this is a detail view rather than the list.
  const rest = pathname.slice(item.href.length).split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href={item.href}
        className="truncate font-semibold text-slate-300 transition-colors hover:text-white"
        aria-current={rest.length === 0 ? 'page' : undefined}
      >
        {item.label}
      </Link>

      {rest.length > 0 ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-slate-600" aria-hidden />
          {/* Ids are not names — resolving them would mean a query per header
              render on every admin page. The last readable segment is the
              honest thing to show: "New", "Convert", "Builder"; a bare id
              falls back to "Details". */}
          <span className="truncate text-slate-400" aria-current="page">
            {label(rest)}
          </span>
        </>
      ) : null}
    </nav>
  );
}

function label(segments: string[]): string {
  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last) || /^[0-9a-f-]{16,}$/i.test(last)) return 'Details';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}
