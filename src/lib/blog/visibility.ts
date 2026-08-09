import { and, isNotNull, lte, or, isNull, eq, sql } from 'drizzle-orm';
import { posts } from '@/db/schema';

/**
 * The condition that decides whether a post is publicly visible.
 *
 * Exists as one shared helper because it was previously written out by hand in
 * six places and **every one of them was wrong the same way**: they filtered on
 * `isPublished` alone and never on `publishedAt`, so setting a publish date a
 * month in the future put the post live immediately. Verified before the fix —
 * a post dated 30 days ahead appeared on /blog and returned 200 on its own URL.
 *
 * A null `publishedAt` counts as visible rather than hidden. Posts predating
 * the scheduling feature have no date, and hiding those would silently
 * unpublish existing content to fix a bug about future ones.
 */
export function publiclyVisible() {
  return and(eq(posts.isPublished, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, sql`now()`)));
}

/** True when a post is published but its date has not arrived — used by the admin list to label it. */
export function isScheduled(post: { isPublished: boolean; publishedAt: Date | null }): boolean {
  return post.isPublished && post.publishedAt !== null && post.publishedAt.getTime() > Date.now();
}

export { isNotNull };
