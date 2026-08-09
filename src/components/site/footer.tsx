import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems, personas } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { getFrontendT } from '@/lib/i18n/translate';
import { getActiveTheme } from '@/lib/branding/theme';
import { currentUser } from '@/lib/auth';
import { buildMenuTree } from '@/lib/navigation/tree';
import { Logo } from './logo';

export async function SiteFooter() {
  const [siteName, tagline, links, featured, { t }, theme, user] = await Promise.all([
    getSettingString('site_name', 'Freelee'),
    getSettingString('site_description', 'Hire an AI specialist for every task.'),
    db
      .select()
      .from(menuItems)
      .where(eq(menuItems.location, 'footer'))
      .orderBy(menuItems.position),
    db
      .select({ name: personas.name, slug: personas.slug })
      .from(personas)
      .where(and(eq(personas.isActive, true), eq(personas.isFeatured, true)))
      .orderBy(desc(personas.messagesCount))
      .limit(5),
    getFrontendT(),
    getActiveTheme(),
    currentUser(),
  ]);

  // A footer item with children becomes its own column; items without children
  // stay together under "Company", which is what the footer did before nesting
  // existed. So adding a parent is opt-in — nothing rearranges on its own.
  const nav = buildMenuTree(links, { signedIn: Boolean(user), isAdmin: user?.isAdmin === true });
  const columns = nav.filter((item) => item.children.length > 0);
  const flat = nav.filter((item) => item.children.length === 0);

  return (
    <footer className="mt-24 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-black">
      <div className="container-app py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Logo srcUrl={theme?.logoUrl} />
              <span className="text-lg font-bold tracking-tight">{siteName}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">{tagline}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('nav.product', 'Product')}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/personas" className="hover:text-brand-600">{t('nav.personas', 'Personas')}</Link></li>
              <li><Link href="/chat" className="hover:text-brand-600">{t('nav.chat', 'Chat')}</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-600">{t('nav.pricing', 'Pricing')}</Link></li>
              <li><Link href="/blog" className="hover:text-brand-600">{t('nav.blog', 'Blog')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('nav.popular_personas', 'Popular personas')}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              {featured.map((persona) => (
                <li key={persona.slug}>
                  <Link href={`/personas/${persona.slug}`} className="hover:text-brand-600">
                    {persona.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <div key={column.id}>
              <h3 className="text-sm font-semibold">{column.label}</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                {column.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      target={child.openInNewTab ? '_blank' : undefined}
                      rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                      className="hover:text-brand-600"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {flat.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">{t('nav.company', 'Company')}</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                {flat.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      target={link.openInNewTab ? '_blank' : undefined}
                      rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                      className="hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>{t('nav.copyright', '© {year} {siteName}. All rights reserved.', { year: new Date().getFullYear(), siteName })}</p>
        </div>
      </div>
    </footer>
  );
}
