import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { SectorForm } from '@/components/admin/sector-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New sector' };

export default async function NewSectorPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.position));

  return <SectorForm categories={categoryRows} defaultCategoryId={categoryId ? Number(categoryId) : undefined} />;
}
