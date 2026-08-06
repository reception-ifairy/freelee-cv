import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { creditLedger, orders } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Billing' };

const STATUS_TONE = {
  paid: 'green',
  pending: 'amber',
  failed: 'rose',
  refunded: 'rose',
  cancelled: 'rose',
} as const;

export default async function BillingPage() {
  const user = await requireUser();

  const [orderRows, ledgerRows] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(50),
    db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, user.id))
      .orderBy(desc(creditLedger.createdAt))
      .limit(100),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Orders and every credit movement on your account.
      </p>

      <Card className="mt-8 overflow-hidden">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">Orders</h2>
        <Table>
          <THead>
            <tr>
              <TH>Reference</TH>
              <TH>Pack</TH>
              <TH>Amount</TH>
              <TH>Credits</TH>
              <TH>Status</TH>
              <TH>Date</TH>
            </tr>
          </THead>
          <TBody>
            {orderRows.length === 0 ? (
              <EmptyRow colSpan={6}>No orders yet.</EmptyRow>
            ) : (
              orderRows.map((order) => (
                <TR key={order.id}>
                  <TD className="font-mono text-xs">{order.reference}</TD>
                  <TD>{order.packName}</TD>
                  <TD>{formatMoney(order.amountCents, order.currency)}</TD>
                  <TD>{order.credits.toLocaleString('en-US')}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                  </TD>
                  <TD className="text-slate-400">{formatDate(order.createdAt)}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-8 overflow-hidden">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">
          Credit ledger
        </h2>
        <Table>
          <THead>
            <tr>
              <TH>Description</TH>
              <TH>Type</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">Balance</TH>
              <TH>Date</TH>
            </tr>
          </THead>
          <TBody>
            {ledgerRows.length === 0 ? (
              <EmptyRow colSpan={5}>No transactions yet.</EmptyRow>
            ) : (
              ledgerRows.map((entry) => (
                <TR key={entry.id}>
                  <TD>{entry.description ?? '—'}</TD>
                  <TD>
                    <Badge>{entry.type}</Badge>
                  </TD>
                  <TD
                    className={
                      entry.amount >= 0
                        ? 'text-right font-semibold text-emerald-600'
                        : 'text-right font-semibold text-slate-500'
                    }
                  >
                    {entry.amount >= 0 ? '+' : '−'}
                    {Math.abs(entry.amount).toLocaleString('en-US')}
                  </TD>
                  <TD className="text-right text-slate-400">
                    {entry.balanceAfter.toLocaleString('en-US')}
                  </TD>
                  <TD className="text-slate-400">{formatDate(entry.createdAt)}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
