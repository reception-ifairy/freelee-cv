import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditTransactions, creditWallets, orders, personas, users } from '@/db/schema';
import { Ban } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Meter } from '@/components/ui/meter';
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

  // Guarded: a customer with no purchases has no ratio, and 0/0 is not 0%.
  const spentRatio =
    (wallet?.lifetimeGranted ?? 0) > 0
      ? Math.min(1, (wallet?.lifetimeSpent ?? 0) / (wallet?.lifetimeGranted ?? 1))
      : 0;

  return (
    <div>
      {/* A suspended account looked completely normal on this screen —
          `isActive` was rendered nowhere, while the list beside it badges the
          state clearly. You could be reading a locked-out customer's ledger
          wondering why they had stopped using the product. */}
      {!account.isActive ? (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm">
          <Ban className="size-4 shrink-0 text-rose-500" />
          <span>
            <strong className="font-semibold text-rose-400">This account is suspended.</strong>{' '}
            <span className="text-slate-400">They cannot sign in or start conversations.</span>
          </span>
        </div>
      ) : null}

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
                    {/* Debits used to be plain slate while credits were green,
                        so spend — the thing you actually scan a ledger for —
                        was the harder half to find. */}
                    <span
                      className={
                        entry.amount >= 0
                          ? 'font-semibold tabular-nums text-emerald-500'
                          : 'font-semibold tabular-nums text-rose-400'
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
          <Card padding="md">
            <p className="text-sm text-slate-500">Current balance</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{(wallet?.balance ?? 0).toLocaleString('en-US')}</p>

            {/* Purchased and spent were two numbers side by side, leaving the
                reader to divide one by the other. The ratio is the actual
                question — is this customer about to run out — and the bar
                answers it without arithmetic. */}
            {(wallet?.lifetimeGranted ?? 0) > 0 ? (
              <div className="mt-4">
                <Meter
                  value={wallet?.lifetimeSpent ?? 0}
                  max={wallet?.lifetimeGranted ?? 0}
                  tone={spentRatio > 0.9 ? 'rose' : spentRatio > 0.7 ? 'amber' : 'emerald'}
                  display={`${Math.round(spentRatio * 100)}% used`}
                  label="Credits used of credits purchased"
                />
              </div>
            ) : null}

            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
              <div className="flex justify-between">
                <dt className="text-slate-500">Purchased</dt>
                <dd className="tabular-nums">{(wallet?.lifetimeGranted ?? 0).toLocaleString('en-US')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Spent</dt>
                <dd className="tabular-nums">{(wallet?.lifetimeSpent ?? 0).toLocaleString('en-US')}</dd>
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
