import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { themes } from '@/db/schema';

/**
 * Cached for an hour: the active theme changes rarely, and this runs on
 * every page. A database hiccup falls back to `null` (compiled-in defaults)
 * rather than taking the entire site down, and lets `next build` run without
 * a live database. Shared by the root layout and every place that renders
 * the site logo (header/footer/auth layout) — one cache entry, not four.
 */
export const getActiveTheme = unstable_cache(
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
