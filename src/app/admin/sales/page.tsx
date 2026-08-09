import type { Metadata } from 'next';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { PageHeader, Stat } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { SalesList, type OrderRow } from './sales-list';
import { formatMoney } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sales' };

export default async function AdminSalesPage() {
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        packName: orders.packName,
        amountCents: orders.amountCents,
        currency: orders.currency,
        gateway: orders.gateway,
        status: orders.status,
        creditsGranted: orders.creditsGranted,
        userName: users.name,
        userId: orders.userId,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .orderBy(desc(orders.createdAt))
      .limit(100),
    db
      .select({
        gross: sql<number>`coalesce(sum(${orders.amountCents}) filter (where ${orders.status} = 'paid'), 0)::int`,
        paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
      })
      .from(orders),
  ]);

  // Sales default to the table: these rows exist to be compared with each
  // other, and a card per order is far more scrolling for the same numbers.
  // The grid is still one click away.
  const view = await getAdminView('sales', 'list');

  const items: OrderRow[] = rows.map((order) => ({
    id: order.id,
    reference: order.reference,
    userName: order.userName,
    userId: order.userId ?? null,
    packName: order.packName,
    amount: formatMoney(order.amountCents, order.currency),
    gateway: order.gateway,
    status: order.status,
    creditsGranted: Boolean(order.creditsGranted),
  }));

  return (
    <div>
      <PageHeader title="Sales" description="Orders, revenue and manual fulfilment." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gross revenue" value={formatMoney(totals?.gross ?? 0)} />
        <Stat label="Paid orders" value={(totals?.paid ?? 0).toLocaleString('en-US')} />
        <Stat label="Awaiting payment" value={(totals?.pending ?? 0).toLocaleString('en-US')} />
      </div>

      <SalesList rows={items} view={view} />

    </div>
  );
}
