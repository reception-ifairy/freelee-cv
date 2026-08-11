import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { creditPacks, orders } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { PacksList, type PackRow } from './packs-list';
import { formatMoney } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Credit packs' };

export default async function AdminPacksPage() {
  // A LEFT JOIN + GROUP BY rather than a correlated subquery. The subquery this
  // replaces had been broken since the initial commit and 500'd the whole page:
  // Drizzle rendered both sides unqualified, so `where "pack_id" = "id"` bound
  // `id` to orders.id (text) instead of credit_packs.id (integer) and Postgres
  // refused with "operator does not exist: integer = text".
  const view = await getAdminView('packs');
  const rows = await db
    .select({
      id: creditPacks.id,
      name: creditPacks.name,
      priceCents: creditPacks.priceCents,
      currency: creditPacks.currency,
      credits: creditPacks.credits,
      bonusCredits: creditPacks.bonusCredits,
      isActive: creditPacks.isActive,
      orderCount: sql<number>`count(${orders.id})::int`,
    })
    .from(creditPacks)
    .leftJoin(orders, eq(orders.packId, creditPacks.id))
    .groupBy(creditPacks.id)
    .orderBy(asc(creditPacks.position));

  const items: PackRow[] = rows.map((pack) => ({
    id: pack.id,
    name: pack.name,
    price: formatMoney(pack.priceCents, pack.currency),
    credits: pack.credits.toLocaleString('en-GB'),
    bonusCredits: pack.bonusCredits,
    orderCount: pack.orderCount,
    isActive: pack.isActive,
  }));

  return (
    <div>
      <PageHeader
        title="Credit packs"
        description="The products your customers buy."
        actions={
          <Link
            href="/admin/packs/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand hover:bg-brand-700"
          >
            <Plus className="size-4" /> New pack
          </Link>
        }
      />

      <PacksList rows={items} view={view} />

    </div>
  );
}
