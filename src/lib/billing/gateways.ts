import 'server-only';
import Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  orders, users, teams, subscriptions, plans, passProducts,
  type CreditPack, type Plan, type PassProduct, type Order,
} from '@/db/schema';
import { grantCredits } from './credits';

/** Stripe's own interval vocabulary — plans.intervalUnit maps onto it directly. */
const STRIPE_INTERVAL: Record<Plan['intervalUnit'], Stripe.PriceCreateParams.Recurring.Interval> = {
  day: 'day', week: 'week', month: 'month', year: 'year',
};

export type GatewayId = 'stripe' | 'paypal' | 'bank';
export type CheckoutResult = { url: string };

export interface PaymentGateway {
  readonly id: GatewayId;
  readonly label: string;
  isEnabled(): boolean;
  createCheckout(order: Order): Promise<CheckoutResult>;
  /** Verifies the signature and returns the order it resolves to, or null. */
  handleWebhook(request: Request, rawBody: string): Promise<Order | null>;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/* ------------------------------- Stripe -------------------------------- */

class StripeGateway implements PaymentGateway {
  readonly id = 'stripe' as const;
  readonly label = 'Card (Stripe)';

  isEnabled() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  private client() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
    return new Stripe(key);
  }

  /**
   * `credit_pack`/`pass` orders check out in `mode: 'payment'` (one-off);
   * `subscription` orders check out in `mode: 'subscription'` with the
   * recurring price built **inline** via `price_data.recurring` — no
   * pre-created Stripe Price object needed, same "define the product at
   * checkout time" pattern the one-off path already used. Once a plan is
   * live in the Stripe Dashboard, Stripe Checkout itself offers whichever
   * payment methods (cards, Apple/Google Pay, bank debits, BNPL) are
   * enabled there — that's a Dashboard/business configuration step, not
   * code; see docs/12-billing-overhaul.md.
   */
  async createCheckout(order: Order): Promise<CheckoutResult> {
    const isSubscription = order.kind === 'subscription';
    let recurring: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring | undefined;

    if (isSubscription) {
      if (!order.planId) throw new Error('Subscription order is missing planId.');
      const [plan] = await db.select().from(plans).where(eq(plans.id, order.planId)).limit(1);
      if (!plan) throw new Error(`Plan ${order.planId} not found.`);
      recurring = { interval: STRIPE_INTERVAL[plan.intervalUnit], interval_count: plan.intervalCount };
    }

    const session = await this.client().checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      client_reference_id: order.reference,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: order.amountCents,
            recurring,
            product_data: {
              name: order.packName,
              description: isSubscription ? undefined : `${order.credits.toLocaleString('en-US')} credits`,
            },
          },
        },
      ],
      metadata: { orderReference: order.reference, userId: order.userId, kind: order.kind },
      success_url: `${appUrl()}/checkout/${order.reference}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/checkout/${order.reference}/cancel`,
    });

    await db.update(orders).set({ gatewayRef: session.id }).where(eq(orders.id, order.id));

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { url: session.url };
  }

  async handleWebhook(request: Request, rawBody: string): Promise<Order | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get('stripe-signature');

    if (!secret || !signature) throw new Error('Stripe webhook is not configured.');

    // Throws on an invalid signature — an unsigned payload never reaches the DB.
    const event = await this.client().webhooks.constructEventAsync(rawBody, signature, secret);

    // Subscription lifecycle events aren't tied to a one-off `orders` row the
    // way checkout completion is — handled here directly (DB writes happen
    // inline), always returning null so the webhook route logs them as
    // "ignored" rather than attempting order fulfillment a second time.
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      await this.handleInvoicePaid(event.data.object);
      return null;
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await this.handleSubscriptionUpdated(event.data.object);
      return null;
    }

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.async_payment_succeeded'
    ) {
      return null;
    }

    const session = event.data.object;
    if (session.payment_status !== 'paid') return null;

    const reference = session.client_reference_id ?? session.metadata?.orderReference;
    if (!reference) return null;

    const [updated] = await db
      .update(orders)
      .set({ status: 'paid', paidAt: new Date(), gatewayRef: session.id })
      .where(eq(orders.reference, reference))
      .returning();

    if (!updated) return null;

    // The subscription itself (not its credits — fulfilOrder() handles
    // those, called by the webhook route right after this returns) is
    // created here, once, from the session's own subscription reference.
    if (updated.kind === 'subscription' && session.subscription && updated.planId) {
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const stripeSub = await this.client().subscriptions.retrieve(subscriptionId);
      const item = stripeSub.items.data[0];

      await db
        .insert(subscriptions)
        .values({
          teamId: updated.teamId,
          planId: updated.planId,
          status: mapStripeStatus(stripeSub.status),
          currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
          currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
          gateway: 'stripe',
          gatewayCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
          gatewaySubscriptionId: stripeSub.id,
        })
        .onConflictDoUpdate({
          target: subscriptions.gatewaySubscriptionId,
          set: { status: mapStripeStatus(stripeSub.status), updatedAt: new Date() },
        });
    }

    return updated;
  }

  /** Renewal — grants the plan's per-cycle credits again and extends the period. */
  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId) return; // a one-off invoice, not a subscription renewal

    const id = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.gatewaySubscriptionId, id)).limit(1);
    if (!sub) return;

    // The *first* invoice is paid as part of checkout.session.completed
    // above (fulfilOrder grants those credits) — only renewals grant here,
    // recognised by billing_reason rather than tracking "is this invoice 1."
    if (invoice.billing_reason !== 'subscription_cycle') return;

    const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
    if (!plan) return;

    const stripeSub = await this.client().subscriptions.retrieve(id);
    const item = stripeSub.items.data[0];

    await db
      .update(subscriptions)
      .set({
        status: mapStripeStatus(stripeSub.status),
        currentPeriodStart: item ? new Date(item.current_period_start * 1000) : sub.currentPeriodStart,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : sub.currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    if (plan.creditsPerCycle > 0) {
      // Attributed to the team's owner for the transaction record — grantCredits
      // resolves the wallet from `teamId` below regardless, this is bookkeeping
      // only, and `teams.ownerId` (unlike a defaultTeamId lookup) always exists.
      const [team] = await db.select({ ownerId: teams.ownerId }).from(teams).where(eq(teams.id, sub.teamId)).limit(1);
      if (!team) return;

      try {
        await grantCredits(team.ownerId, plan.creditsPerCycle, {
          type: 'subscription_grant',
          teamId: sub.teamId,
          description: `Subscription renewal — ${plan.name}`,
          idempotencyKey: `invoice:${invoice.id}`,
          meta: { planId: plan.id, gatewaySubscriptionId: id },
        });
      } catch (error) {
        // Stripe's webhook delivery is at-least-once, not exactly-once — a
        // redelivered `invoice.paid` must not double-grant. The unique index
        // on credit_transactions.idempotency_key is what actually enforces
        // that (a race between two concurrent deliveries can't both win a
        // plain "check then insert"); this catch only recognises the
        // resulting error and treats it as the successful no-op it is,
        // rather than surfacing as a webhook failure Stripe would retry
        // forever.
        const isDuplicate = error instanceof Error && 'code' in error && error.code === '23505';
        if (!isDuplicate) throw error;
      }
    }
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    await db
      .update(subscriptions)
      .set({ status: mapStripeStatus(stripeSub.status), updatedAt: new Date() })
      .where(eq(subscriptions.gatewaySubscriptionId, stripeSub.id));
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): (typeof subscriptions.$inferInsert)['status'] {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': case 'unpaid': return 'past_due';
    case 'canceled': case 'incomplete_expired': return 'canceled';
    default: return 'incomplete';
  }
}

/* -------------------------------- PayPal -------------------------------- */

class PayPalGateway implements PaymentGateway {
  readonly id = 'paypal' as const;
  readonly label = 'PayPal';

  isEnabled() {
    return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  }

  private baseUrl() {
    return process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async token(): Promise<string> {
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
    ).toString('base64');

    const response = await fetch(`${this.baseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) throw new Error('Could not authenticate with PayPal.');

    const json = (await response.json()) as { access_token: string };
    return json.access_token;
  }

  async createCheckout(order: Order): Promise<CheckoutResult> {
    const response = await fetch(`${this.baseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: order.reference,
            custom_id: order.reference,
            description: order.packName,
            amount: { currency_code: order.currency, value: (order.amountCents / 100).toFixed(2) },
          },
        ],
        application_context: {
          user_action: 'PAY_NOW',
          return_url: `${appUrl()}/checkout/${order.reference}/success`,
          cancel_url: `${appUrl()}/checkout/${order.reference}/cancel`,
        },
      }),
    });

    if (!response.ok) throw new Error(`PayPal rejected the order: ${await response.text()}`);

    const json = (await response.json()) as { id: string; links: { rel: string; href: string }[] };

    await db.update(orders).set({ gatewayRef: json.id }).where(eq(orders.id, order.id));

    const approve = json.links.find((link) => link.rel === 'approve');
    if (!approve) throw new Error('PayPal did not return an approval link.');

    return { url: approve.href };
  }

  async handleWebhook(request: Request, rawBody: string): Promise<Order | null> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured.');

    const event = JSON.parse(rawBody) as {
      event_type: string;
      resource: { id?: string; custom_id?: string; purchase_units?: { reference_id?: string }[] };
    };

    // PayPal verifies its own signature server-side.
    const verification = await fetch(`${this.baseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: request.headers.get('paypal-auth-algo'),
        cert_url: request.headers.get('paypal-cert-url'),
        transmission_id: request.headers.get('paypal-transmission-id'),
        transmission_sig: request.headers.get('paypal-transmission-sig'),
        transmission_time: request.headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });

    const verdict = (await verification.json()) as { verification_status?: string };
    if (verdict.verification_status !== 'SUCCESS') throw new Error('PayPal webhook signature is invalid.');

    if (!['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED'].includes(event.event_type)) return null;

    const reference = event.resource.purchase_units?.[0]?.reference_id ?? event.resource.custom_id ?? null;
    if (!reference) return null;

    // Approved but not captured yet — take the money.
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && event.resource.id) {
      const capture = await fetch(`${this.baseUrl()}/v2/checkout/orders/${event.resource.id}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      });

      if (!capture.ok) throw new Error(`PayPal capture failed: ${await capture.text()}`);
    }

    const [updated] = await db
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(orders.reference, reference))
      .returning();

    return updated ?? null;
  }
}

/* ----------------------------- Bank transfer ---------------------------- */

class BankTransferGateway implements PaymentGateway {
  readonly id = 'bank' as const;
  readonly label = 'Bank transfer';

  isEnabled() {
    return process.env.BANK_TRANSFER_ENABLED === 'true';
  }

  async createCheckout(order: Order): Promise<CheckoutResult> {
    // Stays pending until an administrator confirms the transfer.
    return { url: `/checkout/${order.reference}/bank` };
  }

  async handleWebhook(): Promise<Order | null> {
    return null;
  }
}

/* ------------------------------- Registry ------------------------------- */

const GATEWAYS: Record<GatewayId, PaymentGateway> = {
  stripe: new StripeGateway(),
  paypal: new PayPalGateway(),
  bank: new BankTransferGateway(),
};

export function isGatewayId(value: string): value is GatewayId {
  return value in GATEWAYS;
}

export function getGateway(id: GatewayId): PaymentGateway {
  return GATEWAYS[id];
}

export function enabledGateways(): PaymentGateway[] {
  return Object.values(GATEWAYS).filter((gateway) => gateway.isEnabled());
}

/**
 * Sequential per year, then verified unique — two checkouts in the same
 * millisecond must not collide on the unique index.
 */
export async function nextOrderReference(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`extract(year from ${orders.createdAt}) = ${year}`);

  let sequence = (row?.count ?? 0) + 1;

  for (let attempt = 0; attempt < 50; attempt++) {
    const reference = `AIG-${year}-${String(sequence).padStart(5, '0')}`;
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.reference, reference))
      .limit(1);

    if (!existing) return reference;
    sequence++;
  }

  return `AIG-${year}-${Date.now()}`;
}

/** Creates a pending order snapshotting the pack as priced today. */
async function teamIdForUser(userId: string): Promise<string> {
  const [owner] = await db.select({ teamId: users.defaultTeamId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!owner) throw new Error(`User ${userId} not found.`);
  return owner.teamId;
}

export async function createOrder(userId: string, pack: CreditPack, gateway: GatewayId) {
  const [order] = await db
    .insert(orders)
    .values({
      reference: await nextOrderReference(),
      userId,
      teamId: await teamIdForUser(userId),
      kind: 'credit_pack',
      packId: pack.id,
      packName: pack.name,
      credits: pack.credits + pack.bonusCredits,
      amountCents: pack.priceCents,
      currency: pack.currency,
      gateway,
      status: 'pending',
    })
    .returning();

  return order;
}

/** Checkout for a recurring plan — kind='subscription', first cycle's credits set like a purchase. */
export async function createSubscriptionOrder(userId: string, plan: Plan, gateway: GatewayId) {
  const [order] = await db
    .insert(orders)
    .values({
      reference: await nextOrderReference(),
      userId,
      teamId: await teamIdForUser(userId),
      kind: 'subscription',
      planId: plan.id,
      packName: plan.name,
      credits: plan.creditsPerCycle,
      amountCents: plan.priceCents,
      currency: plan.currency,
      gateway,
      status: 'pending',
    })
    .returning();

  return order;
}

/** Checkout for a time-boxed pass — kind='pass', no credits (grants an entitlement instead, see entitlements.ts). */
export async function createPassOrder(userId: string, pass: PassProduct, gateway: GatewayId) {
  const [order] = await db
    .insert(orders)
    .values({
      reference: await nextOrderReference(),
      userId,
      teamId: await teamIdForUser(userId),
      kind: 'pass',
      passProductId: pass.id,
      packName: pass.name,
      credits: 0,
      amountCents: pass.priceCents,
      currency: pass.currency,
      gateway,
      status: 'pending',
    })
    .returning();

  return order;
}
