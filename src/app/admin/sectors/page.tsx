import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Select } from '@/components/ui/field';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { SectorsList } from './sectors-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sectors' };

export default async function AdminSectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const filterId = categoryId ? Number(categoryId) : undefined;

  const view = await getAdminView('sectors');
  const [categoryRows, rows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position)),
    db
      .select({
        id: sectors.id,
        name: sectors.name,
        slug: sectors.slug,
        code: sectors.code,
        categoryId: sectors.categoryId,
        categoryName: categories.name,
        b2cSuitability: sectors.b2cSuitability,
        b2bSuitability: sectors.b2bSuitability,
        b2gSuitability: sectors.b2gSuitability,
        isActive: sectors.isActive,
      })
      .from(sectors)
      .leftJoin(categories, eq(categories.id, sectors.categoryId))
      .where(filterId ? eq(sectors.categoryId, filterId) : undefined)
      .orderBy(asc(sectors.categoryId), asc(sectors.position)),
  ]);

  return (
    <div>
      <PageHeader
        title="Sectors"
        description="Sub-categories with B2C/B2B/B2G suitability scoring."
        actions={
          <Link
            href={filterId ? `/admin/sectors/new?categoryId=${filterId}` : '/admin/sectors/new'}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="size-4" /> New sector
          </Link>
        }
      />

      <form method="GET" className="mb-4 flex items-end gap-3">
        <div className="w-64">
          <Select name="categoryId" defaultValue={filterId ?? ''}>
            <option value="">All categories</option>
            {categoryRows.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Filter
        </button>
      </form>

      <SectorsList rows={rows} view={view} />

    </div>
  );
}
