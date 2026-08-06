import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { deleteCategoryAction } from '@/server/actions/admin';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Categories' };

export default async function AdminCategoriesPage() {
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="size-4" /> New category
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Category</TH>
              <TH className="text-right">Personas</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={4}>No categories yet.</EmptyRow>
            ) : (
              rows.map((category) => (
                <TR key={category.id}>
                  <TD>
                    <Link href={`/admin/categories/${category.id}`} className="flex items-center gap-2 hover:underline">
                      <span
                        className="size-3 rounded-full"
                        style={{ background: category.color ?? '#6366f1' }}
                      />
                      <span className="font-medium">{category.name}</span>
                      <span className="text-xs text-slate-400">/{category.slug}</span>
                    </Link>
                  </TD>
                  <TD className="text-right">{category.count}</TD>
                  <TD>
                    <Badge tone={category.isActive ? 'green' : 'slate'}>
                      {category.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
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
