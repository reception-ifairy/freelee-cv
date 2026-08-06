import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { CategoryForm } from '@/components/admin/category-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) notFound();

  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) notFound();

  return <CategoryForm category={category} />;
}
