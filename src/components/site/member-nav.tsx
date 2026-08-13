'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MemberLink } from '@/lib/site/nav';
import { NavIcon } from './nav-icon';
import { cn } from '@/lib/utils';

/**
 * The signed-in navigation: flat, and it says where you are.
 *
 * A member is going somewhere specific — their chats, their crews — so a mega
 * panel between them and it is friction dressed up as richness. The visitor
 * menu's job is to explain the product; this one's job is to get out of the
 * way.
 *
 * It also marks the current section, which the public header never did for
 * anybody. Same longest-prefix rule as the admin sidebar, so `/chat/abc123`
 * still highlights *Chats*.
 */
export function MemberNav({ links }: { links: MemberLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Workspace">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-ring flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-[--duration-fast]',
              active
                ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white',
            )}
          >
            {link.icon ? (
              <NavIcon name={link.icon} className={cn('size-4 shrink-0', active ? 'text-brand-500 dark:text-brand-400' : 'text-slate-400')} />
            ) : null}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
