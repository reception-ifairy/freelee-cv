import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, messages, orders, personas, users } from '@/db/schema';
import { PageHeader, Stat } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCredits, formatMoney, relativeTime } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminDashboardPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [userStats], [personaStats], [messageStats], [revenueStats],
    perDay, topPersonas, recentOrders, activity,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${users.createdAt} >= ${since.toISOString()})::int`,
      })
      .from(users),
    db.select({ active: sql<number>`count(*) filter (where ${personas.isActive})::int` }).from(personas),
    db
      .select({
        total: sql<number>`count(*)::int`,
        credits: sql<number>`coalesce(sum(${messages.creditsCost}), 0)::int`,
      })
      .from(messages)
      .where(gte(messages.createdAt, since)),
    db
      .select({
        gross: sql<number>`coalesce(sum(${orders.amountCents}) filter (where ${orders.status} = 'paid'), 0)::int`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
      })
      .from(orders),
    db
      .select({
        day: sql<string>`to_char(${messages.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(gte(messages.createdAt, since))
      .groupBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({ name: personas.name, messagesCount: personas.messagesCount, color: personas.accentColor })
      .from(personas)
      .orderBy(desc(personas.messagesCount))
      .limit(5),
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        packName: orders.packName,
        amountCents: orders.amountCents,
        currency: orders.currency,
        status: orders.status,
        userName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .orderBy(desc(orders.createdAt))
      .limit(8),
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(10),
  ]);

  const peak = Math.max(1, ...perDay.map((point) => point.total));

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform activity over the last 30 days." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Customers"
          value={(userStats?.total ?? 0).toLocaleString('en-US')}
          hint={`+${userStats?.recent ?? 0} new`}
        />
        <Stat label="Revenue" value={formatMoney(revenueStats?.gross ?? 0)} />
        <Stat label="Messages" value={(messageStats?.total ?? 0).toLocaleString('en-US')} />
        <Stat label="Credits spent" value={formatCredits(messageStats?.credits ?? 0)} />
      </div>

      {(revenueStats?.pending ?? 0) > 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {revenueStats?.pending} order(s) awaiting payment confirmation.
          <Link href="/admin/sales" className="ml-auto font-semibold underline">
            Review
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold">Messages per day</h2>

          {perDay.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No messages in this period.</p>
          ) : (
            <>
              {/* Drawn inline as flex bars — no charting dependency to keep updated. */}
              <div className="mt-6 flex h-48 items-end gap-1">
                {perDay.map((point) => (
                  <div
                    key={point.day}
                    className="group flex-1 rounded-t bg-brand-500/80 transition hover:glow-ring hover:bg-brand-600"
                    style={{ height: `${Math.max(2, (point.total / peak) * 100)}%` }}
                    title={`${point.day}: ${point.total}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{perDay[0]?.day}</span>
                <span>{perDay[perDay.length - 1]?.day}</span>
              </div>
            </>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Top personas</h2>
          <ul className="mt-4 space-y-3">
            {topPersonas.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-400">No data yet.</li>
            ) : (
              topPersonas.map((persona) => (
                <li key={persona.name} className="flex items-center gap-3">
                  <span className="size-9 rounded-lg" style={{ background: persona.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{persona.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatCredits(persona.messagesCount)} messages
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">
            Recent orders
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No orders yet.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{order.userName ?? 'Deleted user'}</p>
                    <p className="text-xs text-slate-400">
                      {order.packName} · {order.reference}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatMoney(order.amountCents, order.currency)}
                  </span>
                  <Badge tone={order.status === 'paid' ? 'green' : order.status === 'pending' ? 'amber' : 'rose'}>
                    {order.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-slate-800">
            Recent activity
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Nothing logged yet.</p>
            ) : (
              activity.map((entry) => (
                <div key={entry.id} className="px-5 py-3 text-sm">
                  <p>{entry.description ?? entry.action}</p>
                  <p className="text-xs text-slate-400">{relativeTime(entry.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
