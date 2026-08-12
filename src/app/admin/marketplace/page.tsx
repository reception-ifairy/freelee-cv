import type { Metadata } from 'next';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { listings, vendors, personas, payouts } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { approveListingAction, rejectListingAction, suspendListingAction } from '@/server/actions/admin-marketplace';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney, relativeTime } from '@/lib/utils';
import { Store } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PayoutForm } from './payout-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace moderation' };

export default async function AdminMarketplacePage() {
  await requireAdmin();

  const [pending, approved, allVendors, recentPayouts] = await Promise.all([
    db
      .select({ listing: listings, vendor: vendors, persona: personas })
      .from(listings)
      .innerJoin(vendors, eq(vendors.id, listings.vendorId))
      .innerJoin(personas, eq(personas.id, listings.personaId))
      .where(eq(listings.status, 'pending_review'))
      .orderBy(asc(listings.createdAt)),
    db
      .select({ listing: listings, vendor: vendors })
      .from(listings)
      .innerJoin(vendors, eq(vendors.id, listings.vendorId))
      .where(eq(listings.status, 'approved'))
      .orderBy(desc(listings.installCount)),
    db.select({ id: vendors.id, displayName: vendors.displayName }).from(vendors).where(eq(vendors.isActive, true)),
    db.select({ payout: payouts, vendor: vendors }).from(payouts).innerJoin(vendors, eq(vendors.id, payouts.vendorId)).orderBy(desc(payouts.createdAt)).limit(10),
  ]);

  return (
    <div>
      {/* Was a raw <h1>, the only admin screen not using PageHeader — so it had
          no description slot and sat at a different height from every other page. */}
      <PageHeader
        title="Marketplace moderation"
        description="Review what external vendors want to publish, and track what is already live. See docs/16-marketplace.md."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending review ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nothing pending.</p>
            ) : (
              pending.map(({ listing, vendor, persona }) => (
                <div key={listing.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{listing.title}</p>
                      <p className="text-xs text-slate-400">by {vendor.displayName} · persona: {persona.name}</p>
                    </div>
                    <span className="text-xs text-slate-400">{relativeTime(listing.createdAt)}</span>
                  </div>
                  {listing.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{listing.description}</p> : null}
                  <div className="mt-3 flex items-center gap-2">
                    <form action={approveListingAction}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <button type="submit" className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Approve
                      </button>
                    </form>
                    <form action={rejectListingAction}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="moderatorNote" value="Rejected by moderator." />
                      <button type="submit" className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compute a payout</CardTitle>
            <CardDescription>Writes a pending record — no real transfer is executed. See docs/16-marketplace.md.</CardDescription>
          </CardHeader>
          <CardContent>
            {allVendors.length === 0 ? <p className="text-sm text-slate-400">No vendors yet.</p> : <PayoutForm vendors={allVendors} />}

            {recentPayouts.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {recentPayouts.map(({ payout, vendor }) => (
                  <div key={payout.id} className="flex items-center justify-between text-xs">
                    <span>{vendor.displayName}</span>
                    {/* Printed as a raw integer with a ¢ glued on — "249900¢"
                        rather than £2,499.00 — while formatMoney existed and was
                        used on every other money surface in the panel. */}
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{formatMoney(payout.netAmountCents)}</span>
                      <Badge tone={payout.status === 'paid' ? 'green' : payout.status === 'pending' ? 'amber' : 'slate'}>
                        {payout.status}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Live listings ({approved.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {approved.length === 0 ? (
              <EmptyState
                icon={Store}
                title="Nothing live yet"
                description="Approved vendor listings appear here, and can be suspended from this screen."
                className="border-0 py-8"
              />
            ) : null}
            {approved.map(({ listing, vendor }) => (
              <div key={listing.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="truncate text-sm">{listing.title} <span className="text-xs text-slate-400">by {vendor.displayName}</span></span>
                <div className="flex items-center gap-2">
                  {/* Was green, which reads as "healthy" for what is a neutral count. */}
                  <Badge tone="slate">{listing.installCount} installs</Badge>
                  <form action={suspendListingAction}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <button type="submit" className="text-xs font-medium text-rose-500 hover:underline">Suspend</button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
