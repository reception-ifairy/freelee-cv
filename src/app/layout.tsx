import type { Metadata, Viewport } from 'next';
import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { themes } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { getFrontendT } from '@/lib/i18n/translate';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const [name, description] = await Promise.all([
    getSettingString('site_name', 'Freelee').catch(() => 'Freelee'),
    getSettingString('site_description', 'Hire an AI specialist for every task.').catch(
      () => 'Hire an AI specialist for every task.',
    ),
  ]);

  return {
    title: { default: name, template: `%s — ${name}` },
    description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    openGraph: { siteName: name, type: 'website' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

/**
 * Runs before first paint so the colour scheme never flashes. Dark is the
 * house style — it only drops to light when a visitor explicitly picks it
 * via the header toggle.
 */
const themeBootstrap = `
(() => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored !== 'light') document.documentElement.classList.add('dark');
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
`;

/**
 * Cached for an hour: the theme changes rarely, and this runs on every page.
 * A database hiccup falls back to the compiled-in defaults rather than taking
 * the entire site down — and it lets `next build` run without a live database.
 */
const getActiveTheme = unstable_cache(
  async () => {
    try {
      const [theme] = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1);
      return theme ?? null;
    } catch {
      return null;
    }
  },
  ['active-theme'],
  { revalidate: 3600, tags: ['theme'] },
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, { locale }] = await Promise.all([getActiveTheme(), getFrontendT()]);

  const cssVariables = theme
    ? `:root{${Object.entries(theme.tokens)
        .map(([key, value]) => `--color-${key}:${value}`)
        .join(';')}}`
    : '';

  // Mirrors the frontend locale only — this single root layout also wraps
  // /admin, but the admin panel isn't translated yet (phase 2, not this
  // pass; see docs/17-translations.md), and detecting "is this an admin
  // route" here would need a middleware-injected header for no real benefit
  // yet. Revisit once admin_locale actually drives admin panel text.
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {cssVariables ? <style dangerouslySetInnerHTML={{ __html: cssVariables }} /> : null}
        {theme?.customCss ? <style dangerouslySetInnerHTML={{ __html: theme.customCss }} /> : null}
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
