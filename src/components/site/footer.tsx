import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems, personas } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { Logo } from './logo';

export async function SiteFooter() {
  const [siteName, tagline, links, featured] = await Promise.all([
    getSettingString('site_name', 'Freelee'),
    getSettingString('site_description', 'Hire an AI specialist for every task.'),
    db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.location, 'footer'), eq(menuItems.isActive, true)))
      .orderBy(menuItems.position),
    db
      .select({ name: personas.name, slug: personas.slug })
      .from(personas)
      .where(and(eq(personas.isActive, true), eq(personas.isFeatured, true)))
      .orderBy(desc(personas.messagesCount))
      .limit(5),
  ]);

  return (
    <footer className="mt-24 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-black">
      <div className="container-app py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-bold tracking-tight">{siteName}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">{tagline}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/personas" className="hover:text-brand-600">Personas</Link></li>
              <li><Link href="/chat" className="hover:text-brand-600">Chat</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-600">Pricing</Link></li>
              <li><Link href="/blog" className="hover:text-brand-600">Blog</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Popular personas</h3>
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

          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              {links.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} className="hover:text-brand-600">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
