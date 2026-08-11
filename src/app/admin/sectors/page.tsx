import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { parseListParams, type ListConfig } from '@/lib/admin/list-query';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { ListPagination } from '@/components/admin/list-pagination';
import { SectorsList } from './sectors-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sectors' };

export default async function AdminSectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rawParams, categoryRows, view] = await Promise.all([
    searchParams,
    db.select().from(categories).orderBy(asc(categories.position)),
    getAdminView('sectors'),
  ]);

  const config: ListConfig = {
    filters: [
      { key: 'category', label: 'Category', options: categoryRows.map((c) => ({ id: String(c.id), label: c.name })) },
      {
        key: 'status',
        label: 'Status',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'hidden', label: 'Hidden' },
        ],
      },
    ],
    sorts: [
      { id: 'position', label: 'Sort: by category' },
      { id: 'name', label: 'Sort: name A–Z' },
      { id: 'b2c', label: 'Sort: best for consumers' },
      { id: 'b2b', label: 'Sort: best for business' },
      { id: 'b2g', label: 'Sort: best for government' },
    ],
    defaultSort: 'position',
  };

  const params = parseListParams(rawParams, config);

  const conditions = [];
  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(or(ilike(sectors.name, term), ilike(sectors.code, term), ilike(sectors.slug, term)));
  }
  if (params.filters.category) conditions.push(eq(sectors.categoryId, Number(params.filters.category)));
  if (params.filters.status === 'active') conditions.push(eq(sectors.isActive, true));
  if (params.filters.status === 'hidden') conditions.push(eq(sectors.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    {
      position: [asc(sectors.categoryId), asc(sectors.position)],
      name: [asc(sectors.name)],
      b2c: [desc(sectors.b2cSuitability)],
      b2b: [desc(sectors.b2bSuitability)],
      b2g: [desc(sectors.b2gSuitability)],
    }[params.sort] ?? [asc(sectors.categoryId), asc(sectors.position)];

  const [rows, [{ total }]] = await Promise.all([
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
      .where(where)
      .orderBy(...orderBy)
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(sectors).where(where),
  ]);

  const filterId = params.filters.category ? Number(params.filters.category) : undefined;

  return (
    <div>
      <PageHeader
        title="Sectors"
        description="Sub-categories with B2C/B2B/B2G suitability scoring."
        actions={
          <Link
            href={filterId ? `/admin/sectors/new?categoryId=${filterId}` : '/admin/sectors/new'}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
          >
            <Plus className="size-4" /> New sector
          </Link>
        }
      />

      {/* Replaces a category dropdown that needed a separate "Filter" button
          press to apply. Filters now take effect as they are chosen. */}
      <ListToolbar params={params} config={config} total={total} />

      <SectorsList rows={rows} view={view} />

      <ListPagination pathname="/admin/sectors" params={params} config={config} total={total} />
    </div>
  );
}
