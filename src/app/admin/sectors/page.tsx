import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { deleteSectorAction } from '@/server/actions/admin';

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

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Sector</TH>
              <TH>Category</TH>
              <TH className="text-right">B2C</TH>
              <TH className="text-right">B2B</TH>
              <TH className="text-right">B2G</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>No sectors yet.</EmptyRow>
            ) : (
              rows.map((sector) => (
                <TR key={sector.id}>
                  <TD>
                    <Link href={`/admin/sectors/${sector.id}`} className="hover:underline">
                      <span className="font-medium">{sector.name}</span>
                      {sector.code ? <span className="ml-2 font-mono text-xs text-slate-400">{sector.code}</span> : null}
                    </Link>
                  </TD>
                  <TD className="text-slate-500 dark:text-slate-400">{sector.categoryName}</TD>
                  <TD className="text-right font-mono text-xs">{sector.b2cSuitability}</TD>
                  <TD className="text-right font-mono text-xs">{sector.b2bSuitability}</TD>
                  <TD className="text-right font-mono text-xs">{sector.b2gSuitability}</TD>
                  <TD>
                    <Badge tone={sector.isActive ? 'green' : 'slate'}>
                      {sector.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <form action={deleteSectorAction}>
                      <input type="hidden" name="id" value={sector.id} />
                      <button
                        type="submit"
                        className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
