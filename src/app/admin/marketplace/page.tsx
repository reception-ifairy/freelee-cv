import type { Metadata } from 'next';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { listings, vendors, personas, payouts } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/admin/page-header';
import { FormFold } from '@/components/admin/form-fold';
import { PayoutForm } from './payout-form';
import { ListingsList, type ListingRow } from './listings-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace moderation' };

/**
 * Marketplace moderation in the taxonomy's layout (freelee #91): listings by
 * status on the left, the list, a listing's card with Approve / Reject /
 * Suspend. Payouts fold above the list — a rare, monthly job beside a daily one.
 */
export default async function AdminMarketplacePage() {
  await requireAdmin();

  const [rows, allVendors, recentPayouts] = await Promise.all([
    db
      .select({ listing: listings, vendor: vendors.displayName, persona: personas.name })
      .from(listings)
      .innerJoin(vendors, eq(vendors.id, listings.vendorId))
      .leftJoin(personas, eq(personas.id, listings.personaId))
      // The queue first, oldest waiting at the top; then the rest, newest first.
      .orderBy(sql`(${listings.status} = 'pending_review') desc`, sql`case when ${listings.status} = 'pending_review' then ${listings.createdAt} end asc`, desc(listings.createdAt))
      .limit(500),
    db.select({ id: vendors.id, displayName: vendors.displayName }).from(vendors).where(eq(vendors.isActive, true)),
    db.select({ payout: payouts, vendor: vendors }).from(payouts).innerJoin(vendors, eq(vendors.id, payouts.vendorId)).orderBy(desc(payouts.createdAt)).limit(10),
  ]);

  const items: ListingRow[] = rows.map(({ listing, vendor, persona }) => ({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    status: listing.status,
    vendor,
    persona,
    pricingModel: listing.pricingModel,
    installs: listing.installCount,
    submitted: formatDate(listing.createdAt),
    moderatorNote: listing.moderatorNote,
  }));

  const payoutsFold = (
    <FormFold title="Compute a payout">
      <p className="mb-3 text-xs text-slate-400">Writes a pending record — no real transfer is executed. See docs/16-marketplace.md.</p>
      {allVendors.length === 0 ? <p className="pb-3 text-sm text-slate-400">No vendors yet.</p> : <PayoutForm vendors={allVendors} />}
      {recentPayouts.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 pb-3 dark:border-slate-800">
          {recentPayouts.map(({ payout, vendor }) => (
            <div key={payout.id} className="flex items-center justify-between text-xs">
              <span>{vendor.displayName}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{formatMoney(payout.netAmountCents)}</span>
                <Badge tone={payout.status === 'paid' ? 'green' : payout.status === 'pending' ? 'amber' : 'slate'}>{payout.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </FormFold>
  );

  return (
    <div>
      <PageHeader
        title="Marketplace moderation"
        description="Review what external vendors want to publish, and track what is already live. See docs/16-marketplace.md."
      />
      <ListingsList rows={items} before={payoutsFold} />
    </div>
  );
}
