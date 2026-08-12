import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, Coins, MessageSquare, Receipt, Sparkles, Users } from 'lucide-react';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, messages, orders, personas, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { Meter } from '@/components/ui/meter';
import { ActivityIcon } from '@/components/admin/activity-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCredits, formatMoney, relativeTime } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin dashboard' };

/** Percentage change, or null when there is no previous period to compare against. */
function trendPercent(current: number, previous: number): number | null {
  // Growth from zero is not a percentage — "+∞%" is noise, not information.
  // Returning null hides the trend line rather than printing something untrue.
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function AdminDashboardPage() {
  const now = Date.now();
  const WINDOW = 30 * 24 * 60 * 60 * 1000;
  const since = new Date(now - WINDOW);
  // The 30 days *before* the 30 days on screen, so every headline figure can
  // say whether it is going up or down. A number with no comparison is a fact
  // without a meaning, and this screen exists to notice change.
  const previousSince = new Date(now - WINDOW * 2);

  const [
    [userStats], [personaStats], [messageStats], [revenueStats],
    perDay, topPersonas, recentOrders, activity, [previousStats],
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
    // One query for the whole previous window — three counts over two tables
    // beats three round trips for a header row.
    db
      .select({
        messages: sql<number>`count(*) filter (where ${messages.createdAt} >= ${previousSince.toISOString()} and ${messages.createdAt} < ${since.toISOString()})::int`,
        credits: sql<number>`coalesce(sum(${messages.creditsCost}) filter (where ${messages.createdAt} >= ${previousSince.toISOString()} and ${messages.createdAt} < ${since.toISOString()}), 0)::int`,
      })
      .from(messages),
  ]);

  const peak = Math.max(1, ...perDay.map((point) => point.total));
  const topPersonaPeak = Math.max(1, ...topPersonas.map((p) => p.messagesCount ?? 0));

  const messagesTrend = trendPercent(messageStats?.total ?? 0, previousStats?.messages ?? 0);
  const creditsTrend = trendPercent(messageStats?.credits ?? 0, previousStats?.credits ?? 0);

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform activity over the last 30 days." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Customers"
          icon={Users}
          value={(userStats?.total ?? 0).toLocaleString('en-US')}
          hint={`+${userStats?.recent ?? 0} in the last 30 days`}
        />
        {/* Revenue is a lifetime total, not a windowed one, so it has no
            previous period to compare against and gets no trend. */}
        <StatTile label="Revenue" icon={Receipt} value={formatMoney(revenueStats?.gross ?? 0)} hint="All time, paid orders" />
        <StatTile
          label="Messages"
          icon={MessageSquare}
          value={(messageStats?.total ?? 0).toLocaleString('en-US')}
          trend={messagesTrend === null ? undefined : { percent: messagesTrend, label: 'vs previous 30 days' }}
          // The daily series was already fetched for the bar chart below and
          // then used nowhere else — the shape of the month costs nothing here.
          spark={perDay.map((point) => point.total)}
        />
        <StatTile
          label="Credits spent"
          icon={Coins}
          value={formatCredits(messageStats?.credits ?? 0)}
          trend={creditsTrend === null ? undefined : { percent: creditsTrend, label: 'vs previous 30 days' }}
        />
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
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Messages per day</h2>
            {/* The scale was invisible: bars filled their box with nothing
                saying what full height meant, so a quiet month and a busy one
                drew identically. */}
            {perDay.length > 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">peak {peak}/day</p>
            ) : null}
          </div>

          {perDay.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages in this period"
              description="Conversations from the last 30 days appear here as a daily count."
              className="mt-5 border-0 py-10"
            />
          ) : (
            <>
              {/* Drawn inline as flex bars — no charting dependency to keep updated. */}
              <div className="relative mt-6 h-48">
                {/* Gridlines at the quarters, so a bar can be read against a
                    value rather than only against its neighbours. */}
                {[0.25, 0.5, 0.75].map((fraction) => (
                  <span
                    key={fraction}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-white/5"
                    style={{ bottom: `${fraction * 100}%` }}
                  />
                ))}

                <div className="flex h-full items-end gap-1">
                  {perDay.map((point) => (
                    <div key={point.day} className="group relative flex-1">
                      <div
                        className="rounded-t bg-brand-500/80 transition-all duration-[--duration-base] group-hover:bg-brand-400"
                        style={{ height: `${Math.max(2, (point.total / peak) * 192)}px` }}
                      />
                      {/* A real readout rather than the browser's title
                          tooltip, which takes a second to appear and cannot be
                          styled or positioned. */}
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black px-2 py-1 text-[11px] font-medium shadow-lg group-hover:block">
                        <span className="font-mono text-slate-400">{point.day}</span>{' '}
                        <span className="font-semibold">{point.total}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
                <span>{perDay[0]?.day}</span>
                <span>{perDay[perDay.length - 1]?.day}</span>
              </div>
            </>
          )}
        </Card>

        <Card padding="md">
          <h2 className="font-semibold">Top personas</h2>
          <ul className="mt-4 space-y-3.5">
            {topPersonas.length === 0 ? (
              <li>
                <EmptyState
                  icon={Sparkles}
                  title="No usage yet"
                  description="The busiest personas appear here once conversations start."
                  className="border-0 py-6"
                />
              </li>
            ) : (
              topPersonas.map((persona) => (
                <li key={persona.name} className="flex items-center gap-3">
                  <span className="size-9 shrink-0 rounded-lg" style={{ background: persona.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{persona.name}</p>
                    {/* A ranked list with no bars asks the reader to compare
                        numbers that are already sorted — the one job a bar
                        does for free. `peak` was computed for the chart above. */}
                    <Meter
                      className="mt-1 text-xs text-slate-400"
                      value={persona.messagesCount ?? 0}
                      max={topPersonaPeak}
                      display={`${formatCredits(persona.messagesCount)} msg`}
                      label={`${persona.name} messages`}
                    />
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
              <EmptyState icon={Receipt} title="No orders yet" description="Credit pack purchases appear here as they complete." className="border-0 py-8" />
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
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
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
              <EmptyState icon={Activity} title="Nothing logged yet" description="Admin actions — creating, editing, deleting — are recorded here." className="border-0 py-8" />
            ) : (
              activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  {/* `action` was fetched and used only as a fallback when
                      description was null, so every row looked the same and the
                      feed could not be skimmed for "did anything get deleted". */}
                  <ActivityIcon action={entry.action} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{entry.description ?? entry.action}</p>
                    <p className="text-xs text-slate-400">{relativeTime(entry.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
