'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { creditPacks, plans, passProducts, orders } from '@/db/schema';
import { requireAdmin, requireUser } from '@/lib/auth';
import {
  createOrder, createSubscriptionOrder, createPassOrder, getGateway, isGatewayId,
} from '@/lib/billing/gateways';
import { adjustCredits, fulfilOrder, spendCredits } from '@/lib/billing/credits';

export async function checkoutAction(formData: FormData) {
  const user = await requireUser();

  const parsed = z
    .object({ packSlug: z.string().min(1), gateway: z.string().min(1) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success || !isGatewayId(parsed.data.gateway)) redirect('/pricing?error=invalid');

  const [pack] = await db
    .select()
    .from(creditPacks)
    .where(and(eq(creditPacks.slug, parsed.data.packSlug), eq(creditPacks.isActive, true)))
    .limit(1);

  if (!pack) redirect('/pricing?error=unknown-pack');

  const order = await createOrder(user.id, pack, parsed.data.gateway);

  let url: string;
  try {
    ({ url } = await getGateway(parsed.data.gateway).createCheckout(order));
  } catch (error) {
    console.error('[checkout] failed to create session', error);
    await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, order.id));
    redirect('/pricing?error=gateway');
  }

  redirect(url);
}

/**
 * Subscriptions: Stripe only this phase — inline recurring `price_data`
 * (see gateways.ts) needs Stripe Checkout specifically; PayPal subscriptions
 * are a real, different API, deliberately not built yet (see
 * docs/12-billing-overhaul.md).
 */
export async function subscribeAction(formData: FormData) {
  const user = await requireUser();

  const planKey = z.string().min(1).parse(formData.get('planKey'));
  const [plan] = await db.select().from(plans).where(and(eq(plans.key, planKey), eq(plans.isActive, true))).limit(1);
  if (!plan) redirect('/pricing?error=unknown-plan');

  const order = await createSubscriptionOrder(user.id, plan, 'stripe');

  let url: string;
  try {
    ({ url } = await getGateway('stripe').createCheckout(order));
  } catch (error) {
    console.error('[subscribe] failed to create session', error);
    await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, order.id));
    redirect('/pricing?error=gateway');
  }

  redirect(url);
}

export async function buyPassAction(formData: FormData) {
  const user = await requireUser();

  const parsed = z
    .object({ passKey: z.string().min(1), gateway: z.string().min(1) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || !isGatewayId(parsed.data.gateway)) redirect('/pricing?error=invalid');

  const [pass] = await db
    .select()
    .from(passProducts)
    .where(and(eq(passProducts.key, parsed.data.passKey), eq(passProducts.isActive, true)))
    .limit(1);
  if (!pass) redirect('/pricing?error=unknown-pass');

  const order = await createPassOrder(user.id, pass, parsed.data.gateway);

  let url: string;
  try {
    ({ url } = await getGateway(parsed.data.gateway).createCheckout(order));
  } catch (error) {
    console.error('[pass] failed to create session', error);
    await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, order.id));
    redirect('/pricing?error=gateway');
  }

  redirect(url);
}

/* ------------------------------ Admin only ------------------------------ */

export async function markOrderPaidAction(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().min(1).parse(formData.get('orderId'));

  await db.update(orders).set({ status: 'paid', paidAt: new Date() }).where(eq(orders.id, orderId));
  await fulfilOrder(orderId);

  revalidatePath('/admin/sales');
}

export async function refundOrderAction(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().min(1).parse(formData.get('orderId'));

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;

  if (order.creditsGranted) {
    // Reclaim the credits. If the customer already spent them the balance
    // cannot go negative, so the attempt is logged rather than forced.
    try {
      await spendCredits(order.userId, order.credits, {
        teamId: order.teamId,
        description: `Refund — ${order.reference}`,
      });
    } catch {
      console.warn(`[refund] ${order.reference}: customer had already spent the credits`);
    }
  }

  await db
    .update(orders)
    .set({ status: 'refunded', refundedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath('/admin/sales');
}

export async function adjustCreditsAction(formData: FormData) {
  await requireAdmin();

  const parsed = z
    .object({
      userId: z.string().min(1),
      amount: z.coerce.number().int().refine((n) => n !== 0, 'Amount cannot be zero.'),
      reason: z.string().trim().min(1).max(255),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return;

  await adjustCredits(parsed.data.userId, parsed.data.amount, parsed.data.reason);
  revalidatePath(`/admin/customers/${parsed.data.userId}`);
}
