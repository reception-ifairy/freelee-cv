import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { BlockRenderer } from '@/components/site/block-renderer';

export const revalidate = 300;

export default async function HomePage() {
  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'home'), isNull(pageSections.pageId), isNull(pageSections.parentId)))
    .orderBy(asc(pageSections.position));

  // `parentId is null` keeps children of a columns container out of the top
  // level — the container renders its own children, so listing them here too
  // would draw them twice.
  return <BlockRenderer rows={rows} />;
}
