import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditWallets, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { toggleUserActiveAction } from '@/server/actions/admin';
import { formatDate, initialsOf } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customers' };

export default async function AdminCustomersPage() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      // The user's *team* wallet balance (personal teams = same number as
      // before; a real shared balance for genuine multi-member teams). See
      // docs/12-billing-overhaul.md.
      credits: sql<number>`coalesce(${creditWallets.balance}, 0)::int`,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      chatCount: sql<number>`(select count(*) from ${chats} where ${chats.userId} = ${users.id})::int`,
    })
    .from(users)
    .leftJoin(creditWallets, and(eq(creditWallets.ownerId, users.defaultTeamId), eq(creditWallets.ownerType, 'team')))
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div>
      <PageHeader title="Customers" description="Accounts, balances and activity." />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Customer</TH>
              <TH>Credits</TH>
              <TH className="text-right">Chats</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>No customers yet.</EmptyRow>
            ) : (
              rows.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {initialsOf(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                      </div>
                      {user.isAdmin ? <Badge tone="brand">admin</Badge> : null}
                    </div>
                  </TD>
                  <TD className="font-semibold">{user.credits.toLocaleString('en-US')}</TD>
                  <TD className="text-right">{user.chatCount}</TD>
                  <TD>
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <button type="submit">
                        <Badge tone={user.isActive ? 'green' : 'rose'}>
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </button>
                    </form>
                  </TD>
                  <TD className="text-slate-400">{formatDate(user.createdAt)}</TD>
                  <TD className="text-right">
                    <Link
                      href={`/admin/customers/${user.id}`}
                      className="grid size-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
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
