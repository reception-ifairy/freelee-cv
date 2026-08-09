import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pages, personas, posts } from '@/db/schema';
import { publiclyVisible } from '@/lib/blog/visibility';

export const revalidate = 3600;

/**
 * The static routes always exist. Database-backed entries are added when the
 * query succeeds — a sitemap must never be the reason a deploy fails.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/personas`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const [personaRows, postRows, pageRows] = await Promise.all([
      db
        .select({ slug: personas.slug, updatedAt: personas.updatedAt })
        .from(personas)
        .where(eq(personas.isActive, true)),
      db
        .select({ slug: posts.slug, updatedAt: posts.updatedAt })
        .from(posts)
        .where(publiclyVisible()),
      db
        .select({ slug: pages.slug, updatedAt: pages.updatedAt, noindex: pages.noindex })
        .from(pages)
        .where(eq(pages.isPublished, true)),
    ]);

    return [
      ...staticRoutes,
      ...personaRows.map((row) => ({
        url: `${base}/personas/${row.slug}`,
        lastModified: row.updatedAt,
        priority: 0.7,
      })),
      ...postRows.map((row) => ({
        url: `${base}/blog/${row.slug}`,
        lastModified: row.updatedAt,
        priority: 0.6,
      })),
      ...pageRows
        .filter((row) => !row.noindex)
        .map((row) => ({ url: `${base}/${row.slug}`, lastModified: row.updatedAt, priority: 0.5 })),
    ];
  } catch (error) {
    console.error('[sitemap] falling back to static routes', error);
    return staticRoutes;
  }
}
