import type { Metadata } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { vendors, listings, personas, teamMembers } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { submitListingForReviewAction } from '@/server/actions/marketplace';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BecomeVendorForm, CreateListingForm } from './vendor-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vendor' };

const STATUS_TONE = { draft: 'slate', pending_review: 'amber', approved: 'green', rejected: 'rose', suspended: 'rose' } as const;

export default async function VendorPage() {
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  const [member] = await db
    .select({ role: teamMembers.role, permissions: teamMembers.permissions })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
    .limit(1);
  const canManage = member ? hasPermission(member, 'team.manage_marketplace') : false;

  const [vendor] = await db.select().from(vendors).where(eq(vendors.teamId, teamId)).limit(1);

  if (!vendor) {
    return (
      <div className="container-app py-10">
        <h1 className="text-2xl font-bold tracking-tight">Become a vendor</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          List personas from your catalog for other teams to install into theirs.
        </p>
        {canManage ? (
          <Card className="mt-6 max-w-lg p-6">
            <BecomeVendorForm />
          </Card>
        ) : (
          <p className="mt-6 text-sm text-slate-400">Ask a team owner or admin to set this up.</p>
        )}
      </div>
    );
  }

  const [teamListings, ownPersonas] = await Promise.all([
    db.select().from(listings).where(eq(listings.vendorId, vendor.id)).orderBy(desc(listings.createdAt)),
    db.select({ id: personas.id, name: personas.name }).from(personas).where(eq(personas.teamId, teamId)).orderBy(personas.name),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-2xl font-bold tracking-tight">{vendor.displayName}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Your listings, visible to other teams once approved.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your listings</CardTitle>
            <CardDescription>Draft → submit for review → a platform admin approves or rejects it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamListings.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No listings yet.</p>
            ) : (
              teamListings.map((listing) => (
                <div key={listing.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{listing.title}</p>
                    <p className="text-xs text-slate-400">
                      {listing.installCount} install{listing.installCount === 1 ? '' : 's'}
                      {listing.moderatorNote ? ` · ${listing.moderatorNote}` : ''}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[listing.status]}>{listing.status}</Badge>
                  {canManage && listing.status === 'draft' ? (
                    <form action={submitListingForReviewAction}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <button type="submit" className="text-xs font-medium text-brand-600 hover:underline">
                        Submit for review
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>New listing</CardTitle>
            </CardHeader>
            <CardContent>
              {ownPersonas.length === 0 ? (
                <p className="text-sm text-slate-400">Create a persona first.</p>
              ) : (
                <CreateListingForm personas={ownPersonas} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
