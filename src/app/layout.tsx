import type { Metadata, Viewport } from 'next';
import { getSettingString } from '@/lib/settings';
import { getFrontendT } from '@/lib/i18n/translate';
import { fontStack } from '@/lib/branding/fonts';
import { getActiveTheme } from '@/lib/branding/theme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const [name, description, theme] = await Promise.all([
    getSettingString('site_name', 'Freelee').catch(() => 'Freelee'),
    getSettingString('site_description', 'Hire an AI specialist for every task.').catch(
      () => 'Hire an AI specialist for every task.',
    ),
    getActiveTheme(),
  ]);

  return {
    title: { default: name, template: `%s — ${name}` },
    description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    openGraph: { siteName: name, type: 'website' },
    robots: { index: true, follow: true },
    icons: theme?.faviconUrl ? { icon: theme.faviconUrl } : undefined,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, { locale }] = await Promise.all([getActiveTheme(), getFrontendT()]);

  const headingStack = fontStack(theme?.headingFont);
  const bodyStack = fontStack(theme?.bodyFont);

  const cssVariables = theme
    ? `:root{${[
        ...Object.entries(theme.tokens).map(([key, value]) => `--color-${key}:${value}`),
        headingStack ? `--font-heading:${headingStack}` : '',
        bodyStack ? `--font-sans:${bodyStack}` : '',
      ]
        .filter(Boolean)
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
        {/* Always loaded, matching the admin layout's pattern — cheap, cached, and lets an admin switch to either curated font without a deploy. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {cssVariables ? <style dangerouslySetInnerHTML={{ __html: cssVariables }} /> : null}
        {theme?.customCss ? <style dangerouslySetInnerHTML={{ __html: theme.customCss }} /> : null}
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
