import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditTransactions, creditWallets, orders, personas, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { adjustCreditsAction } from '@/server/actions/billing';
import { toggleUserAdminAction } from '@/server/actions/admin';
import { formatDate, formatMoney, relativeTime } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customer' };

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [account] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!account) notFound();

  const [chatRows, orderRows, [wallet], ledgerRows] = await Promise.all([
    db
      .select({
        id: chats.id,
        title: chats.title,
        messagesCount: chats.messagesCount,
        lastMessageAt: chats.lastMessageAt,
        personaName: personas.name,
      })
      .from(chats)
      .leftJoin(personas, eq(personas.id, chats.personaId))
      .where(eq(chats.userId, id))
      .orderBy(desc(chats.lastMessageAt))
      .limit(10),
    db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(10),
    // Team wallet — the real balance since Phase 5, see docs/12-billing-overhaul.md.
    db.select().from(creditWallets).where(eq(creditWallets.ownerId, account.defaultTeamId)).limit(1),
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.teamId, account.defaultTeamId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20),
  ]);

  return (
    <div>
      <PageHeader
        title={account.name}
        description={account.email}
        actions={
          <>
            <Link
              href="/admin/customers"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Back
            </Link>
            <form action={toggleUserAdminAction}>
              <input type="hidden" name="id" value={account.id} />
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {account.isAdmin ? 'Revoke admin' : 'Grant admin'}
              </button>
            </form>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">
              Recent conversations
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {chatRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No conversations.</p>
              ) : (
                chatRows.map((chat) => (
                  <div key={chat.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{chat.title ?? 'Conversation'}</p>
                      <p className="text-xs text-slate-400">
                        {chat.personaName} · {chat.messagesCount} messages
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{relativeTime(chat.lastMessageAt)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">
              Credit ledger
            </h2>
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {ledgerRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No transactions.</p>
              ) : (
                ledgerRows.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{entry.description ?? entry.type}</p>
                      <p className="text-xs text-slate-400">{formatDate(entry.createdAt)}</p>
                    </div>
                    <span
                      className={
                        entry.amount >= 0
                          ? 'font-semibold text-emerald-600'
                          : 'font-semibold text-slate-500'
                      }
                    >
                      {entry.amount >= 0 ? '+' : '−'}
                      {Math.abs(entry.amount).toLocaleString('en-US')}
                    </span>
                    <span className="w-20 text-right text-xs text-slate-400">
                      {entry.balanceAfter.toLocaleString('en-US')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <p className="text-sm text-slate-500">Current balance</p>
            <p className="mt-1 text-3xl font-bold">{(wallet?.balance ?? 0).toLocaleString('en-US')}</p>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
              <div className="flex justify-between">
                <dt className="text-slate-500">Purchased</dt>
                <dd>{(wallet?.lifetimeGranted ?? 0).toLocaleString('en-US')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Spent</dt>
                <dd>{(wallet?.lifetimeSpent ?? 0).toLocaleString('en-US')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Joined</dt>
                <dd>{formatDate(account.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Adjust balance</h3>
            <form action={adjustCreditsAction} className="mt-3 space-y-3">
              <input type="hidden" name="userId" value={account.id} />
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" placeholder="e.g. 500 or -200" required />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" name="reason" placeholder="Goodwill credit" required />
              </div>
              <button
                type="submit"
                className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-on-brand hover:bg-brand-700"
              >
                Apply adjustment
              </button>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold dark:border-slate-800">
              Orders
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orderRows.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-400">No orders.</p>
              ) : (
                orderRows.map((order) => (
                  <div key={order.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{order.packName}</span>
                    <span className="font-medium">
                      {formatMoney(order.amountCents, order.currency)}
                    </span>
                    <Badge tone={order.status === 'paid' ? 'green' : 'slate'}>{order.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
