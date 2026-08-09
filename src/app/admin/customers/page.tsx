import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditWallets, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { CustomersList, type CustomerRow } from './customers-list';
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

  // Customers default to the table for the same reason as sales: this list is
  // scanned and compared, not browsed.
  const view = await getAdminView('customers', 'list');

  const items: CustomerRow[] = rows.map((user) => ({
    id: user.id,
    name: user.name ?? 'Unnamed',
    email: user.email ?? '',
    initials: initialsOf(user.name),
    credits: user.credits.toLocaleString('en-GB'),
    chatCount: user.chatCount,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    joined: formatDate(user.createdAt),
  }));

  return (
    <div>
      <PageHeader title="Customers" description="Accounts, balances and activity." />

      <CustomersList rows={items} view={view} />

    </div>
  );
}
