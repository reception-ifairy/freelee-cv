import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { listings, vendors, personas, listingInstalls, listingReviews, users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import { InstallButton, ReviewForm } from './listing-actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Listing' };

const PRICING_LABEL = { free: 'Free to install', credit_markup: 'Pay as you go — usage-based', one_off: 'One-off purchase (coming soon)', subscription: 'Subscription (coming soon)' } as const;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  const [row] = await db
    .select({ listing: listings, vendor: vendors, persona: personas })
    .from(listings)
    .innerJoin(vendors, eq(vendors.id, listings.vendorId))
    .innerJoin(personas, eq(personas.id, listings.personaId))
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row || (row.listing.status !== 'approved' && row.vendor.teamId !== teamId)) notFound();

  const [[installed], reviews] = await Promise.all([
    db
      .select({ id: listingInstalls.id })
      .from(listingInstalls)
      .where(and(eq(listingInstalls.listingId, listingId), eq(listingInstalls.installingTeamId, teamId)))
      .limit(1),
    db
      .select({ review: listingReviews, userName: users.name })
      .from(listingReviews)
      .innerJoin(users, eq(users.id, listingReviews.userId))
      .where(eq(listingReviews.listingId, listingId))
      .orderBy(desc(listingReviews.createdAt))
      .limit(20),
  ]);

  const isOwnListing = row.vendor.teamId === teamId;

  return (
    <div className="container-app py-10">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{row.listing.title}</h1>
            <Badge tone={row.listing.status === 'approved' ? 'green' : 'amber'}>{row.listing.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">by {row.vendor.displayName}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
            {row.listing.description || row.persona.tagline || 'No description.'}
          </p>

          <Card className="mt-6 p-5">
            <h2 className="mb-3 text-sm font-semibold">Reviews {row.listing.ratingCount > 0 ? `(${row.listing.ratingAvg.toFixed(1)}★, ${row.listing.ratingCount})` : ''}</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-400">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map(({ review, userName }) => (
                  <div key={review.id} className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{userName}</span>
                      <span className="text-amber-500">{'★'.repeat(review.rating)}</span>
                      <span className="text-xs text-slate-400">{relativeTime(review.createdAt)}</span>
                    </div>
                    {review.comment ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p> : null}
                  </div>
                ))}
              </div>
            )}

            {installed ? (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <h3 className="mb-2 text-sm font-semibold">Leave a review</h3>
                <ReviewForm listingId={listingId} />
              </div>
            ) : null}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">{PRICING_LABEL[row.listing.pricingModel]}</p>
          {row.listing.pricingModel === 'credit_markup' && row.listing.creditMarkupPct ? (
            <p className="mt-1 text-xs text-slate-400">Vendor earns {row.listing.creditMarkupPct}% of the credits this persona charges.</p>
          ) : null}

          <div className="mt-4">
            {isOwnListing ? (
              <p className="text-sm text-slate-400">This is your own listing.</p>
            ) : installed ? (
              <Badge tone="green">Already installed</Badge>
            ) : row.listing.status !== 'approved' ? (
              <p className="text-sm text-slate-400">Not available.</p>
            ) : row.listing.pricingModel === 'one_off' || row.listing.pricingModel === 'subscription' ? (
              <p className="text-sm text-slate-400">Purchase flow not available yet.</p>
            ) : (
              <InstallButton listingId={listingId} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
