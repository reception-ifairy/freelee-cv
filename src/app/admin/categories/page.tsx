import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { CategoriesList } from './categories-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Categories' };

export default async function AdminCategoriesPage() {
  const view = await getAdminView('categories');
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      color: categories.color,
      isActive: categories.isActive,
      count: sql<number>`count(${personaCategories.personaId})::int`,
    })
    .from(categories)
    .leftJoin(personaCategories, eq(personaCategories.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position));

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Group personas so people can find them."
        actions={
          <Link
            href="/admin/categories/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
          >
            <Plus className="size-4" /> New category
          </Link>
        }
      />

      <CategoriesList rows={rows} view={view} />

    </div>
  );
}
