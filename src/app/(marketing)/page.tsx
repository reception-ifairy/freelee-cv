import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { BlockRenderer } from '@/components/site/block-renderer';

export const revalidate = 300;

export default async function HomePage() {
  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'home'), isNull(pageSections.pageId), isNull(pageSections.postId)))
    .orderBy(asc(pageSections.position));

  // Children of a columns container are fetched too — BlockRenderer partitions
  // them so a container draws its own children and they are not also rendered
  // at the top level.
  return <BlockRenderer rows={rows} />;
}
