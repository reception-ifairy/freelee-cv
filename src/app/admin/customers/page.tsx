import type { Metadata } from 'next';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chats, creditWallets, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { listHref, parseListParams, type ListConfig } from '@/lib/admin/list-query';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { ListPagination } from '@/components/admin/list-pagination';
import { CustomersList, type CustomerRow } from './customers-list';
import { formatDate, initialsOf } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customers' };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Customers default to the table for the same reason as sales: this list is
  // scanned and compared, not browsed.
  const rawParams = await searchParams;

  const config: ListConfig = {
    filters: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'suspended', label: 'Suspended' },
          { id: 'admin', label: 'Admins' },
        ],
      },
    ],
    sorts: [
      { id: 'newest', label: 'Sort: newest first' },
      { id: 'name', label: 'Sort: name A–Z' },
      { id: 'credits', label: 'Sort: most credits' },
    ],
    defaultSort: 'newest',
  };

  const params = parseListParams(rawParams, config);

  const conditions = [];
  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(or(ilike(users.name, term), ilike(users.email, term)));
  }
  // The rail counts each status within the search, so its numbers match what a click shows.
  const searched = conditions.length > 0 ? and(...conditions) : undefined;
  if (params.filters.status === 'active') conditions.push(eq(users.isActive, true));
  if (params.filters.status === 'suspended') conditions.push(eq(users.isActive, false));
  if (params.filters.status === 'admin') conditions.push(eq(users.isAdmin, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    {
      newest: [desc(users.createdAt)],
      name: [asc(users.name)],
      credits: [desc(sql`coalesce(${creditWallets.balance}, 0)`)],
    }[params.sort] ?? [desc(users.createdAt)];

  const [rows, [{ total }], [counts]] = await Promise.all([
    db
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
        // A LEFT JOIN + GROUP BY, not a correlated subquery. The subquery this
        // replaces rendered as `where "user_id" = "id"` with both sides
        // unqualified, so Postgres bound `id` to chats.id rather than users.id
        // and every customer showed 0 chats. Unlike the identical bug on
        // /admin/packs, both columns are text here, so it did not error — it
        // just quietly reported the wrong number. Verified: Platform Admin has
        // 6 chats and the page said 0.
        chatCount: sql<number>`count(distinct ${chats.id})::int`,
      })
      .from(users)
      .leftJoin(creditWallets, and(eq(creditWallets.ownerId, users.defaultTeamId), eq(creditWallets.ownerType, 'team')))
      .leftJoin(chats, eq(chats.userId, users.id))
      .where(where)
      .groupBy(users.id, creditWallets.balance)
      .orderBy(...orderBy)
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
    db
      .select({
        all: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.isActive})::int`,
        suspended: sql<number>`count(*) filter (where not ${users.isActive})::int`,
        admin: sql<number>`count(*) filter (where ${users.isAdmin})::int`,
      })
      .from(users)
      .where(searched),
  ]);
  // The taxonomy's layout (#91): statuses on the left, counted in SQL — the list is paged, so
  // counting the rows on screen would be wrong past the first page.
  const status = params.filters.status ?? '';
  const rail = [
    { id: '', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'suspended', label: 'Suspended', count: counts.suspended },
    { id: 'admin', label: 'Admins', count: counts.admin },
  ].map((r) => ({ label: r.label, count: r.count, active: status === r.id, href: listHref('/admin/customers', params, config, { filters: { status: r.id }, page: 1 }) }));

  const items: CustomerRow[] = rows.map((user) => ({
    id: user.id,
    name: user.name ?? 'Unnamed',
    email: user.email ?? '',
    initials: initialsOf(user.name),
    credits: user.credits.toLocaleString('en-GB'),
    creditsValue: user.credits,
    chatCount: user.chatCount,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    joined: formatDate(user.createdAt),
  }));

  return (
    <div>
      <PageHeader title="Customers" description="Accounts, balances and activity." />

      <CustomersList
        rows={items}
        rail={rail}
        toolbar={<ListToolbar params={params} config={config} total={total} placeholder="Search by name or email…" />}
        pagination={<ListPagination pathname="/admin/customers" params={params} config={config} total={total} />}
      />

    </div>
  );
}
