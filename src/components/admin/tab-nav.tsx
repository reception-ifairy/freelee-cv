import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TabNavItem = {
  id: string;
  label: string;
  href: string;
  /** Shown beside the label — "Personas 16". Omitted when undefined; 0 is shown. */
  count?: number | string;
};

/**
 * Tabs as links (`?tab=…`), rendered on the server.
 *
 * The admin had tabs four ways: links on a bot team, buttons in client state on
 * the block editor and the theme composer, a settings sidebar. Links are the
 * one that survives a reload, can be linked to, works before hydration and
 * runs only the open tab's queries — so new tabbed screens (a category's
 * workspace, the homeschool hub) use this.
 *
 * `aria-current="page"` rather than the ARIA tab pattern: each tab is a
 * navigation to another URL, not a panel switched in place, and a screen
 * reader should announce it as a link.
 */
export function TabNav({
  label,
  tabs,
  active,
  className,
}: {
  /** What the tabs are, for screen readers — "Team sections". */
  label: string;
  tabs: readonly TabNavItem[];
  active: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn('mb-6 flex gap-0.5 overflow-x-auto border-b border-slate-200 dark:border-white/10', className)}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          scroll={false}
          aria-current={active === tab.id ? 'page' : undefined}
          className={cn(
            '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
            active === tab.id
              ? 'border-brand-500 text-brand-700 dark:text-brand-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
