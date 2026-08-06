import 'server-only';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { entitlements, passProducts, orders, type Entitlement } from '@/db/schema';

type GrantOptions = {
  userId?: string | null;
  sourceId?: string | null;
  targetId?: string | null;
  expiresAt?: Date | null;
};

export async function grantEntitlement(
  teamId: string,
  sourceType: Entitlement['sourceType'],
  targetType: Entitlement['targetType'],
  options: GrantOptions = {},
) {
  const [entitlement] = await db
    .insert(entitlements)
    .values({
      teamId,
      userId: options.userId ?? null,
      sourceType,
      sourceId: options.sourceId ?? null,
      targetType,
      targetId: options.targetId ?? null,
      expiresAt: options.expiresAt ?? null,
    })
    .returning();

  return entitlement;
}

/**
 * True if the team has a live (not expired, not revoked) entitlement for
 * this target. `targetId: null` matches a team-wide grant (e.g.
 * `targetType: 'platform'` — see the chat route's pass-coverage check,
 * docs/12-billing-overhaul.md) rather than one scoped to a specific
 * persona/model/module.
 */
export async function hasActiveEntitlement(
  teamId: string,
  targetType: Entitlement['targetType'],
  targetId?: string | null,
): Promise<boolean> {
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.teamId, teamId),
        eq(entitlements.targetType, targetType),
        targetId ? eq(entitlements.targetId, targetId) : isNull(entitlements.targetId),
        isNull(entitlements.revokedAt),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date())),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Grants the entitlement for a paid pass order — exactly once, mirroring
 * `fulfilOrder()`'s idempotency shape but keyed on the entitlement's own
 * existence rather than a flag column (passes don't have one; `orders.id`
 * as `sourceId` is the dedupe key).
 */
export async function fulfilPassOrder(orderId: string): Promise<'granted' | 'skipped'> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.kind !== 'pass' || order.status !== 'paid' || !order.passProductId) return 'skipped';

  const [existing] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.sourceType, 'pass'), eq(entitlements.sourceId, order.id)))
    .limit(1);
  if (existing) return 'skipped';

  const [pass] = await db.select().from(passProducts).where(eq(passProducts.id, order.passProductId)).limit(1);
  if (!pass) return 'skipped';

  const ms = { hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 }[pass.durationUnit];
  const expiresAt = new Date(Date.now() + pass.durationValue * ms);

  await grantEntitlement(order.teamId, 'pass', 'platform', {
    userId: order.userId,
    sourceId: order.id,
    expiresAt,
  });

  return 'granted';
}
