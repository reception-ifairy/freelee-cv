import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { creditPacks, orders } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { deletePackAction } from '@/server/actions/admin';
import { formatMoney } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Credit packs' };

export default async function AdminPacksPage() {
  const rows = await db
    .select({
      id: creditPacks.id,
      name: creditPacks.name,
      priceCents: creditPacks.priceCents,
      currency: creditPacks.currency,
      credits: creditPacks.credits,
      bonusCredits: creditPacks.bonusCredits,
      isActive: creditPacks.isActive,
      orderCount: sql<number>`(select count(*) from ${orders} where ${orders.packId} = ${creditPacks.id})::int`,
    })
    .from(creditPacks)
    .orderBy(asc(creditPacks.position));

  return (
    <div>
      <PageHeader
        title="Credit packs"
        description="The products your customers buy."
        actions={
          <Link
            href="/admin/packs/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> New pack
          </Link>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
            No credit packs yet.
          </p>
        ) : (
          rows.map((pack) => {
            const total = pack.credits + pack.bonusCredits;
            const perUnit = pack.priceCents > 0 ? Math.round(total / (pack.priceCents / 100)) : 0;

            return (
              <Card key={pack.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">{pack.name}</h2>
                    <p className="mt-1 text-2xl font-bold">
                      {formatMoney(pack.priceCents, pack.currency)}
                    </p>
                  </div>
                  <Badge tone={pack.isActive ? 'green' : 'slate'}>
                    {pack.isActive ? 'Live' : 'Hidden'}
                  </Badge>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Credits</dt>
                    <dd>{pack.credits.toLocaleString('en-US')}</dd>
                  </div>
                  {pack.bonusCredits > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Bonus</dt>
                      <dd className="text-emerald-600">+{pack.bonusCredits.toLocaleString('en-US')}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Value</dt>
                    <dd>{perUnit.toLocaleString('en-US')} cr / {pack.currency}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Orders</dt>
                    <dd>{pack.orderCount}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex gap-2 pt-5">
                  <Link
                    href={`/admin/packs/${pack.id}`}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Edit
                  </Link>
                  <form action={deletePackAction}>
                    <input type="hidden" name="id" value={pack.id} />
                    <button
                      type="submit"
                      className="grid size-10 place-items-center rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
