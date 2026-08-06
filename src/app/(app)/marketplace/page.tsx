import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { listings, vendors, personas } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace' };

const PRICING_LABEL = { free: 'Free', credit_markup: 'Pay as you go', one_off: 'One-off (coming soon)', subscription: 'Subscription (coming soon)' } as const;

export default async function MarketplacePage() {
  await requireUser();

  const rows = await db
    .select({ listing: listings, vendor: vendors, persona: personas })
    .from(listings)
    .innerJoin(vendors, eq(vendors.id, listings.vendorId))
    .innerJoin(personas, eq(personas.id, listings.personaId))
    .where(eq(listings.status, 'approved'))
    .orderBy(desc(listings.installCount));

  return (
    <div className="container-app py-10">
      <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Personas built and listed by other teams — install one into your own catalog.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <p className="col-span-full py-16 text-center text-sm text-slate-400">No listings yet.</p>
        ) : (
          rows.map(({ listing, vendor, persona }) => (
            <Link key={listing.id} href={`/marketplace/${listing.id}`} className="block">
              <Card className="h-full p-5 transition hover:opacity-80">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{listing.title}</h2>
                  <Badge tone={listing.pricingModel === 'free' ? 'green' : 'brand'} className="shrink-0">
                    {PRICING_LABEL[listing.pricingModel]}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {listing.description || persona.tagline || 'No description.'}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  by {vendor.displayName} · {listing.installCount} install{listing.installCount === 1 ? '' : 's'}
                  {listing.ratingCount > 0 ? ` · ${listing.ratingAvg.toFixed(1)}★ (${listing.ratingCount})` : ''}
                </p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
