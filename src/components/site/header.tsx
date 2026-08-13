import Link from 'next/link';
import { Zap } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { getBalanceForTeam } from '@/lib/billing/credits';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { getSettingString } from '@/lib/settings';
import { getFrontendT } from '@/lib/i18n/translate';
import { getActiveTheme } from '@/lib/branding/theme';
import { formatCredits } from '@/lib/utils';
import { buildMenuTree } from '@/lib/navigation/tree';
import { VISITOR_NAV, MEMBER_NAV, type NavSection } from '@/lib/site/nav';
import { MegaMenu } from './mega-menu';
import { MobileNav } from './mobile-nav';
import { MemberNav } from './member-nav';
import { NavDropdown } from './nav-dropdown';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/**
 * The public header, which now serves two different people.
 *
 * Every `menu_items` row was `visibleTo: 'all'`, so a first-time visitor and a
 * paying customer saw an identical five-link bar. Those are opposite jobs: a
 * visitor is deciding whether the product is for them and needs the catalogue,
 * the proof and the price; a member has already decided and needs their own
 * conversations. See `lib/site/nav.ts`.
 *
 * Admin-managed rows from `menu_items` are still rendered — appended after the
 * built-in sections — so adding a custom link in the admin keeps working. Two
 * separate nav systems would drift apart within a release.
 */
export async function SiteHeader() {
  const [user, siteName, links, { t }, theme] = await Promise.all([
    currentUser(),
    getSettingString('site_name', 'Freelee'),
    db.select().from(menuItems).where(eq(menuItems.location, 'header')).orderBy(menuItems.position),
    getFrontendT(),
    getActiveTheme(),
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

  const custom = buildMenuTree(links, { signedIn: Boolean(user), isAdmin: user?.isAdmin === true });

  // Custom rows join the built-in sections as plain links (or a dropdown when
  // they have children), rather than being merged into a mega panel — an
  // admin-added link has no column to belong to and guessing one would be
  // worse than putting it plainly beside them.
  const visitorSections: NavSection[] = [
    ...VISITOR_NAV,
    ...custom
      .filter((link) => link.children.length === 0 && !isCoveredByBuiltIn(link.href))
      .map((link): NavSection => ({ kind: 'link', label: link.label, href: link.href })),
  ];

  const memberLinks = MEMBER_NAV.filter((link) => {
    if (link.module === 'group-chat') return roomsEnabled;
    if (link.module === 'crews') return crewsEnabled;
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b hairline bg-white/85 backdrop-blur-xl dark:bg-black/85">
      <div className="container-app flex h-16 items-center gap-2">
        <Link href="/" className="focus-ring flex shrink-0 items-center gap-2 rounded-control pr-2">
          <Logo srcUrl={theme?.logoUrl} />
          <span className="text-lg font-bold tracking-tight">{siteName}</span>
        </Link>

        {user ? (
          <MemberNav links={memberLinks} />
        ) : (
          <div className="ml-3">
            <MegaMenu sections={visitorSections} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <>
              <Link
                href="/pricing"
                title="Your credit balance"
                className="focus-ring hidden items-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-sm font-semibold transition hover:bg-slate-100 sm:inline-flex dark:hover:bg-white/[0.06]"
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
                className="focus-ring hidden rounded-control px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:block dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                {t('nav.sign_in', 'Sign in')}
              </Link>
              <Link
                href="/register"
                className="focus-ring glow-btn inline-flex h-10 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
              >
                {t('nav.get_started', 'Get started')}
              </Link>
            </>
          )}

          <MobileNav
            sections={user ? memberSections(memberLinks) : visitorSections}
            signedIn={Boolean(user)}
            signInLabel={t('nav.sign_in', 'Sign in')}
            getStartedLabel={t('nav.get_started', 'Get started')}
          />
        </div>
      </div>

      {/* Custom parents with children keep the original dropdown. They are
          admin-authored and can be any shape, so they get the component that
          copes with any shape rather than a panel expecting columns. */}
      {custom.some((link) => link.children.length > 0) ? (
        <div className="container-app hidden gap-1 pb-2 lg:flex">
          {custom
            .filter((link) => link.children.length > 0)
            .map((link) => (
              <NavDropdown key={link.id} label={link.label} children={link.children} />
            ))}
        </div>
      ) : null}
    </header>
  );
}

/** Built-in sections already cover these, so a duplicate row is dropped rather than shown twice. */
function isCoveredByBuiltIn(href: string): boolean {
  return ['/personas', '/pricing', '/blog', '/bionic', '/chat', '/marketplace'].includes(href);
}

/** The member links, in the shape MobileNav renders. */
function memberSections(links: typeof MEMBER_NAV): NavSection[] {
  return links.map((link) => ({ kind: 'link', label: link.label, href: link.href }));
}
