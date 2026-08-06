import type { Metadata } from 'next';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { PageHeader, Stat } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { markOrderPaidAction, refundOrderAction } from '@/server/actions/billing';
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

  return (
    <div>
      <PageHeader title="Sales" description="Orders, revenue and manual fulfilment." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gross revenue" value={formatMoney(totals?.gross ?? 0)} />
        <Stat label="Paid orders" value={(totals?.paid ?? 0).toLocaleString('en-US')} />
        <Stat label="Awaiting payment" value={(totals?.pending ?? 0).toLocaleString('en-US')} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Reference</TH>
              <TH>Customer</TH>
              <TH>Pack</TH>
              <TH>Amount</TH>
              <TH>Gateway</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>No orders yet.</EmptyRow>
            ) : (
              rows.map((order) => (
                <TR key={order.id}>
                  <TD className="font-mono text-xs">{order.reference}</TD>
                  <TD>{order.userName ?? '—'}</TD>
                  <TD>{order.packName}</TD>
                  <TD className="font-semibold">{formatMoney(order.amountCents, order.currency)}</TD>
                  <TD>
                    <Badge>{order.gateway}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Badge
                        tone={
                          order.status === 'paid' ? 'green' : order.status === 'pending' ? 'amber' : 'rose'
                        }
                      >
                        {order.status}
                      </Badge>
                      {order.creditsGranted ? <Badge>credited</Badge> : null}
                    </div>
                  </TD>
                  <TD className="text-right">
                    {order.status === 'pending' ? (
                      <form action={markOrderPaidAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <button
                          type="submit"
                          className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Mark paid
                        </button>
                      </form>
                    ) : order.status === 'paid' ? (
                      <form action={refundOrderAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <button type="submit" className="h-8 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                          Refund
                        </button>
                      </form>
                    ) : null}
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
