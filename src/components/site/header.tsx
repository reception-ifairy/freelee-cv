import Link from 'next/link';
import { Zap } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { getBalanceForTeam } from '@/lib/billing/credits';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { getSettingString } from '@/lib/settings';
import { formatCredits } from '@/lib/utils';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export async function SiteHeader() {
  const [user, siteName, links] = await Promise.all([
    currentUser(),
    getSettingString('site_name', 'Freelee'),
    db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.location, 'header'), eq(menuItems.isActive, true)))
      .orderBy(menuItems.position),
  ]);

  // user.defaultTeamId can be missing on a stale JWT session cookie predating
  // when this field was added to the token (JWT-strategy sessions never
  // re-fetch from the DB after initial sign-in) — guard on the field itself,
  // not just on `user`, so a session like that degrades gracefully instead of
  // crashing every page render (drizzle throws UNDEFINED_VALUE on an
  // undefined query param, not a soft null-safe result).
  const balance = user?.defaultTeamId ? await getBalanceForTeam(user.defaultTeamId) : undefined;
  const roomsEnabled = user?.defaultTeamId ? await isModuleEnabledForTeam(user.defaultTeamId, 'group-chat') : false;
  const crewsEnabled = user?.defaultTeamId ? await isModuleEnabledForTeam(user.defaultTeamId, 'crews') : false;

  const visible = links.filter((link) => {
    if (link.visibleTo === 'guest') return !user;
    if (link.visibleTo === 'auth') return Boolean(user);
    if (link.visibleTo === 'admin') return user?.isAdmin === true;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-black/85">
      <div className="container-app flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">{siteName}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {visible.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              target={link.openInNewTab ? '_blank' : undefined}
              rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <>
              <Link
                href="/pricing"
                className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold sm:inline-flex dark:border-slate-700"
              >
                <Zap className="size-4 text-accent-500" />
                {formatCredits(balance ?? 0)}
              </Link>
              <UserMenu
                name={user.name ?? 'Account'}
                email={user.email ?? ''}
                isAdmin={user.isAdmin}
                roomsEnabled={roomsEnabled}
                crewsEnabled={crewsEnabled}
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:block dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="glow-btn inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
