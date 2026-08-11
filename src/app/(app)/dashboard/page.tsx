import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Zap } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditTransactions, creditWallets, messages, personas, users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { formatCredits, relativeTime, truncate } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await requireUser();

  const [[account], [wallet], recentChats, ledger, [usage]] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.id)).limit(1),
    db.select().from(creditWallets).where(eq(creditWallets.ownerId, session.defaultTeamId)).limit(1),
    db
      .select({
        id: chats.id,
        title: chats.title,
        messagesCount: chats.messagesCount,
        lastMessageAt: chats.lastMessageAt,
        personaName: personas.name,
        personaColor: personas.accentColor,
      })
      .from(chats)
      .leftJoin(personas, eq(personas.id, chats.personaId))
      .where(eq(chats.userId, session.id))
      .orderBy(desc(chats.lastMessageAt))
      .limit(6),
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.teamId, session.defaultTeamId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(10),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(chats, eq(chats.id, messages.chatId))
      .where(eq(chats.userId, session.id)),
  ]);

  if (!account) throw new Error('Account not found.');

  const stats = [
    { label: 'Messages sent', value: (usage?.total ?? 0).toLocaleString('en-US') },
    { label: 'Credits spent', value: formatCredits(wallet?.lifetimeSpent ?? 0) },
    { label: 'Credits purchased', value: formatCredits(wallet?.lifetimeGranted ?? 0) },
  ];

  return (
    <div className="container-app py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {account.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Here is what has been happening on your account.
          </p>
        </div>
        <Link
          href="/personas"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
        >
          <Plus className="size-4" />
          New conversation
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
          <p className="text-sm text-brand-100">Credit balance</p>
          <p className="mt-2 text-3xl font-bold">{(wallet?.balance ?? 0).toLocaleString('en-US')}</p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-100 hover:text-white"
          >
            <Zap className="size-3" /> Top up
          </Link>
        </Card>

        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold">Recent conversations</h2>
            <Link href="/chat" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentChats.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No conversations yet.</p>
            ) : (
              recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span
                    className="size-10 shrink-0 rounded-xl"
                    style={{ background: chat.personaColor ?? '#94a3b8' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {chat.title ?? truncate(chat.personaName, 30) ?? 'Conversation'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {chat.personaName} · {chat.messagesCount} messages
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{relativeTime(chat.lastMessageAt)}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold">Credit activity</h2>
            <Link href="/dashboard/billing" className="text-sm text-brand-600 hover:underline">
              All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ledger.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No activity yet.</p>
            ) : (
              ledger.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={
                      entry.amount >= 0
                        ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600 dark:bg-emerald-500/15'
                        : 'grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800'
                    }
                  >
                    {entry.amount >= 0 ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{entry.description ?? entry.type}</p>
                    <p className="text-xs text-slate-400">{relativeTime(entry.createdAt)}</p>
                  </div>
                  <span
                    className={
                      entry.amount >= 0
                        ? 'text-sm font-semibold text-emerald-600'
                        : 'text-sm font-semibold text-slate-500'
                    }
                  >
                    {Math.abs(entry.amount).toLocaleString('en-US')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
