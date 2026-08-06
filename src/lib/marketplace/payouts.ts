import 'server-only';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { listings, listingInstalls, usageEvents, payouts, type Payout } from '@/db/schema';

/**
 * Cents per credit, for turning `credit_markup` revenue share into a real
 * payout amount. Not read from `creditPacks` dynamically (the packs don't
 * even agree with each other — Starter is 900¢/5000cr = 0.18¢/credit, the
 * bulkier Studio pack is closer to 0.124¢/credit) — a fixed blended rate,
 * using the entry-level pack's rate, is a deliberate simplification for a
 * feature that only ever produces a *preview* payout amount this phase
 * (see the file comment below). Revisit if real payouts are ever executed.
 */
const CREDIT_VALUE_CENTS = 0.18;

export type PayoutComputation = { grossCreditsCharged: number; netAmountCents: number };

/**
 * Revenue share is computed from `usageEvents.creditsCharged` the
 * installed persona already earned — not an added surcharge on top of what
 * the installing team is charged. This is why installing a `credit_markup`
 * listing needed no change to the hot chat-billing path
 * (src/app/api/chat/route.ts) at all: the vendor's cut comes out of the
 * platform's existing take, computed after the fact from usage history,
 * not collected as an extra charge at message time. See docs/16-marketplace.md.
 */
export async function computePayout(vendorId: string, periodStart: Date, periodEnd: Date): Promise<PayoutComputation> {
  const installs = await db
    .select({ installedPersonaId: listingInstalls.installedPersonaId, markupPct: listingInstalls.creditMarkupPctSnapshot })
    .from(listingInstalls)
    .innerJoin(listings, eq(listings.id, listingInstalls.listingId))
    .where(and(eq(listings.vendorId, vendorId), eq(listings.pricingModel, 'credit_markup')));

  let grossCreditsCharged = 0;
  let netAmountCents = 0;

  for (const install of installs) {
    if (!install.markupPct) continue;

    const [usage] = await db
      .select({ total: sql<string>`coalesce(sum(${usageEvents.creditsCharged}), 0)` })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.personaId, install.installedPersonaId),
          gte(usageEvents.createdAt, periodStart),
          lt(usageEvents.createdAt, periodEnd),
        ),
      );

    const credits = Number(usage?.total ?? 0);
    grossCreditsCharged += credits;
    netAmountCents += Math.round(credits * CREDIT_VALUE_CENTS * (install.markupPct / 100));
  }

  return { grossCreditsCharged, netAmountCents };
}

/**
 * Writes a `payouts` row — a **record of what's owed**, `status: 'pending'`,
 * never a real transfer. `stripeTransferId` stays null forever unless a
 * human, outside this app's automation, actually pays the vendor and marks
 * it manually (or a future phase wires real Stripe Connect transfers — not
 * this one). See docs/16-marketplace.md for why executing real payouts was
 * kept out of scope rather than half-built.
 */
export async function createPayoutRecord(vendorId: string, periodStart: Date, periodEnd: Date): Promise<Payout> {
  const { grossCreditsCharged, netAmountCents } = await computePayout(vendorId, periodStart, periodEnd);

  const [payout] = await db
    .insert(payouts)
    .values({ vendorId, periodStart, periodEnd, grossCreditsCharged, netAmountCents })
    .returning();

  return payout;
}
