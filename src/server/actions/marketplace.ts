'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  vendors, listings, listingInstalls, listingReviews, personas, teamMembers,
} from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { slugify } from '@/lib/utils';
import { installListing, ListingUnavailableError } from '@/lib/marketplace/install';
import type { ActionState } from './auth';

async function requireMarketplacePermission(teamId: string, userId: string): Promise<void> {
  const [member] = await db
    .select({ role: teamMembers.role, permissions: teamMembers.permissions })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  if (!member || !hasPermission(member, 'team.manage_marketplace')) throw new Error('FORBIDDEN');
}

async function uniqueVendorSlug(base: string): Promise<string> {
  const root = slugify(base) || 'vendor';
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, candidate)).limit(1);
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const becomeVendorSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(2000).optional(),
  payoutEmail: z.string().trim().email().optional().or(z.literal('')),
});

export async function becomeVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await requireMarketplacePermission(teamId, user.id);

  const parsed = becomeVendorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.teamId, teamId)).limit(1);
  if (existing) return { error: 'This team is already a vendor.' };

  await db.insert(vendors).values({
    teamId,
    displayName: parsed.data.displayName,
    slug: await uniqueVendorSlug(parsed.data.displayName),
    bio: parsed.data.bio || null,
    payoutEmail: parsed.data.payoutEmail || null,
  });

  revalidatePath('/dashboard/vendor');
  return { success: 'Vendor profile created — you can now list personas for other teams to install.' };
}

const saveListingSchema = z.object({
  personaId: z.coerce.number().int(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  pricingModel: z.enum(['free', 'one_off', 'subscription', 'credit_markup']),
  creditMarkupPct: z.coerce.number().min(0).max(100).optional(),
});

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await requireMarketplacePermission(teamId, user.id);

  const [vendor] = await db.select().from(vendors).where(eq(vendors.teamId, teamId)).limit(1);
  if (!vendor) return { error: 'Become a vendor first.' };

  const parsed = saveListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const data = parsed.data;

  if (data.pricingModel === 'one_off' || data.pricingModel === 'subscription') {
    return { error: 'One-off and subscription pricing are not available yet — use free or credit-markup for now.' };
  }
  if (data.pricingModel === 'credit_markup' && !data.creditMarkupPct) {
    return { error: 'Set a credit markup percentage.' };
  }

  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(and(eq(personas.id, data.personaId), eq(personas.teamId, teamId)))
    .limit(1);
  if (!persona) return { error: 'Persona not found in this team.' };

  await db.insert(listings).values({
    vendorId: vendor.id,
    personaId: data.personaId,
    title: data.title,
    description: data.description || null,
    pricingModel: data.pricingModel,
    creditMarkupPct: data.pricingModel === 'credit_markup' ? data.creditMarkupPct : null,
    status: 'draft',
  });

  revalidatePath('/dashboard/vendor');
  return { success: 'Listing created as a draft — submit it for review when ready.' };
}

export async function submitListingForReviewAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  await requireMarketplacePermission(teamId, user.id);

  const listingId = z.string().min(1).parse(formData.get('listingId'));
  const [listing] = await db
    .select({ id: listings.id, vendorId: listings.vendorId, status: listings.status })
    .from(listings)
    .innerJoin(vendors, eq(vendors.id, listings.vendorId))
    .where(and(eq(listings.id, listingId), eq(vendors.teamId, teamId)))
    .limit(1);
  if (!listing || listing.status !== 'draft') return;

  await db.update(listings).set({ status: 'pending_review' }).where(eq(listings.id, listingId));
  revalidatePath('/dashboard/vendor');
}

export async function installListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const teamId = user.defaultTeamId;
  const listingId = z.string().min(1).parse(formData.get('listingId'));

  try {
    await installListing(listingId, teamId, user.id);
  } catch (error) {
    if (error instanceof ListingUnavailableError) return { error: error.message };
    throw error;
  }

  revalidatePath('/marketplace');
  redirect('/personas');
}

const reviewSchema = z.object({
  listingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function reviewListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { listingId, rating, comment } = parsed.data;

  const [installed] = await db
    .select({ id: listingInstalls.id })
    .from(listingInstalls)
    .where(and(eq(listingInstalls.listingId, listingId), eq(listingInstalls.installingTeamId, teamId)))
    .limit(1);
  if (!installed) return { error: 'Install this listing before reviewing it.' };

  await db
    .insert(listingReviews)
    .values({ listingId, installingTeamId: teamId, userId: user.id, rating, comment: comment || null })
    .onConflictDoUpdate({
      target: [listingReviews.listingId, listingReviews.installingTeamId],
      set: { rating, comment: comment || null },
    });

  const allReviews = await db
    .select({ rating: listingReviews.rating })
    .from(listingReviews)
    .where(eq(listingReviews.listingId, listingId));
  const ratingAvg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await db.update(listings).set({ ratingAvg, ratingCount: allReviews.length }).where(eq(listings.id, listingId));

  revalidatePath('/marketplace');
  return { success: 'Review saved.' };
}
