'use server';

// Named admin-marketplace.ts, not admin/marketplace.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-billing.ts.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { createPayoutRecord } from '@/lib/marketplace/payouts';
import type { ActionState } from './auth';

export async function approveListingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const listingId = z.string().min(1).parse(formData.get('listingId'));
  await db
    .update(listings)
    .set({ status: 'approved', approvedAt: new Date(), approvedBy: admin.id, moderatorNote: null })
    .where(eq(listings.id, listingId));
  revalidatePath('/admin/marketplace');
}

const rejectSchema = z.object({ listingId: z.string().min(1), moderatorNote: z.string().trim().max(500).optional() });

export async function rejectListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { listingId, moderatorNote } = rejectSchema.parse(Object.fromEntries(formData));
  await db.update(listings).set({ status: 'rejected', moderatorNote: moderatorNote || null }).where(eq(listings.id, listingId));
  revalidatePath('/admin/marketplace');
}

export async function suspendListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingId = z.string().min(1).parse(formData.get('listingId'));
  await db.update(listings).set({ status: 'suspended' }).where(eq(listings.id, listingId));
  revalidatePath('/admin/marketplace');
}

const payoutSchema = z.object({
  vendorId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

/**
 * Writes a `payouts` row — a computed preview of what's owed, never a real
 * Stripe transfer. See src/lib/marketplace/payouts.ts and docs/16-marketplace.md.
 */
export async function generatePayoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const { vendorId, periodStart, periodEnd } = parsed.data;
  const payout = await createPayoutRecord(vendorId, new Date(periodStart), new Date(periodEnd));

  revalidatePath('/admin/marketplace');
  return { success: `Payout computed: ${payout.netAmountCents} cents from ${payout.grossCreditsCharged} credits.` };
}
