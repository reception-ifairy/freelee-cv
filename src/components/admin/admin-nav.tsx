'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV, TONE_CLASSES, isNavItemCurrent, type AdminNavSection } from '@/lib/admin/nav';
import { cn } from '@/lib/utils';

/**
 * The admin sidebar links.
 *
 * A client component purely so it can read `usePathname`. Until now the whole
 * layout was a Server Component that never knew which route was open, so every
 * one of the 23 links rendered identically — the panel could not tell you
 * where you were. `settings-nav.tsx` already did this correctly; this brings
 * the main nav up to the same standard.
 *
 * The active treatment is three signals at once, because one is fragile:
 * a left rail (position), a tinted background (area), and a full-strength icon
 * (colour). Colour alone would fail for anyone who cannot distinguish it.
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Admin sections">
      {ADMIN_NAV.map((section) => (
        <NavSection key={section.heading ?? 'root'} section={section} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function NavSection({
  section, pathname, onNavigate,
}: {
  section: AdminNavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  const tone = TONE_CLASSES[section.tone];

  return (
    <div>
      {section.heading ? (
        <p className="mt-4 px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {section.heading}
        </p>
      ) : null}

      {section.items.map((item) => {
        const active = isNavItemCurrent(item, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-control px-3 py-2 font-medium transition-colors duration-[--duration-fast]',
              active
                ? 'bg-white/[0.06] text-white'
                : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200',
            )}
          >
            {/* The rail sits inside the row rather than on its border so it
                cannot shift the text by a pixel when it appears. */}
            {active ? (
              <span className={cn('absolute inset-y-1.5 left-0 w-0.5 rounded-full', tone.rail)} aria-hidden />
            ) : null}
            <item.icon className={cn('size-4 shrink-0 transition-colors duration-[--duration-fast]', active ? tone.active : tone.idle)} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
