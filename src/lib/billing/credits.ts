import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, creditWallets, creditTransactions, orders, type CreditTransaction } from '@/db/schema';
import { creditsPer1k, type ProviderId, type ProviderRegistry } from '@/lib/ai/registry';

export const MINIMUM_CHARGE = 1;

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Not enough credits: ${required} required, ${available} available.`);
    this.name = 'InsufficientCreditsError';
  }
}

type TransactionType = CreditTransaction['type'];

/**
 * Every wallet mutation locks the wallet row inside a transaction — two
 * concurrent requests against the same team therefore cannot spend the same
 * credits twice, the second waits for the first to commit. Every team
 * (including personal teams — "a workspace of one," see schema.ts) has
 * exactly one wallet, created at team-creation time
 * (src/server/actions/auth.ts, src/lib/teams.ts) — this throws loudly if one
 * is somehow missing rather than silently creating one mid-request.
 */
async function lockWalletForTeam(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], teamId: string) {
  const [wallet] = await tx
    .select()
    .from(creditWallets)
    .where(eq(creditWallets.ownerId, teamId))
    .for('update');

  if (!wallet) throw new Error(`No credit wallet for team ${teamId} — teams must be created with one.`);
  return wallet;
}

async function teamIdForUser(userId: string): Promise<string> {
  const [row] = await db.select({ teamId: users.defaultTeamId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new Error(`User ${userId} not found.`);
  return row.teamId;
}

type GrantOptions = {
  type?: TransactionType;
  description?: string;
  orderId?: string | null;
  /** Skips the userId → team lookup when the caller already knows it (e.g. webhook handlers). */
  teamId?: string;
  idempotencyKey?: string;
  meta?: Record<string, unknown>;
};

/**
 * Grants credits to the *team's* wallet (not a per-user balance) — every
 * team member draws from the same pool. For today's personal teams this is
 * indistinguishable from a per-user balance (one member = the same person),
 * which is exactly the point: no behavior change for solo users, real
 * shared billing once a team has more than one member. See
 * docs/12-billing-overhaul.md.
 */
export async function grantCredits(userId: string, amount: number, options: GrantOptions = {}) {
  if (amount <= 0) throw new Error('Granted amount must be positive.');

  const type = options.type ?? 'purchase';
  const teamId = options.teamId ?? (await teamIdForUser(userId));

  return db.transaction(async (tx) => {
    const wallet = await lockWalletForTeam(tx, teamId);
    const balanceAfter = wallet.balance + amount;
    const isGrant = type === 'purchase' || type === 'bonus' || type === 'subscription_grant';

    await tx
      .update(creditWallets)
      .set({
        balance: balanceAfter,
        lifetimeGranted: isGrant ? wallet.lifetimeGranted + amount : wallet.lifetimeGranted,
        updatedAt: new Date(),
      })
      .where(eq(creditWallets.id, wallet.id));

    const [entry] = await tx
      .insert(creditTransactions)
      .values({
        walletId: wallet.id,
        teamId,
        userId,
        type,
        amount,
        balanceAfter,
        referenceType: options.orderId ? 'order' : null,
        referenceId: options.orderId ?? null,
        idempotencyKey: options.idempotencyKey ?? null,
        description: options.description ?? null,
        meta: options.meta ?? null,
      })
      .returning();

    return entry;
  });
}

type SpendOptions = {
  description?: string;
  messageId?: string | null;
  teamId?: string;
  meta?: Record<string, unknown>;
};

export async function spendCredits(userId: string, rawAmount: number, options: SpendOptions = {}) {
  const amount = Math.max(MINIMUM_CHARGE, Math.ceil(rawAmount));
  const teamId = options.teamId ?? (await teamIdForUser(userId));

  return db.transaction(async (tx) => {
    const wallet = await lockWalletForTeam(tx, teamId);
    if (wallet.balance < amount) throw new InsufficientCreditsError(amount, wallet.balance);

    const balanceAfter = wallet.balance - amount;

    await tx
      .update(creditWallets)
      .set({ balance: balanceAfter, lifetimeSpent: wallet.lifetimeSpent + amount, updatedAt: new Date() })
      .where(eq(creditWallets.id, wallet.id));

    const [entry] = await tx
      .insert(creditTransactions)
      .values({
        walletId: wallet.id,
        teamId,
        userId,
        type: 'spend',
        amount: -amount,
        balanceAfter,
        referenceType: options.messageId ? 'message' : null,
        referenceId: options.messageId ?? null,
        description: options.description ?? null,
        meta: options.meta ?? null,
      })
      .returning();

    return entry;
  });
}

/** Admin correction; accepts a signed amount. */
export async function adjustCredits(userId: string, signedAmount: number, reason: string) {
  return signedAmount >= 0
    ? grantCredits(userId, signedAmount, { type: 'adjustment', description: reason })
    : spendCredits(userId, Math.abs(signedAmount), { description: reason });
}

/**
 * Grants the credits attached to a paid order — exactly once, even if the
 * payment provider replays the webhook. The guard and the flag flip share one
 * transaction, so a duplicate delivery finds `creditsGranted` already true.
 * Handles all three order kinds' credit component; pass/subscription side
 * effects beyond credits (entitlements, the `subscriptions` row) are handled
 * separately — see src/lib/billing/entitlements.ts and
 * StripeGateway.handleWebhook, both called alongside this, not instead of it.
 */
export async function fulfilOrder(orderId: string): Promise<'granted' | 'skipped'> {
  const claimed = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');

    if (!order || order.creditsGranted || order.status !== 'paid') return null;

    await tx.update(orders).set({ creditsGranted: true }).where(eq(orders.id, orderId));
    return order;
  });

  if (!claimed) return 'skipped';

  // A pure access-pass order can carry zero credits — grantCredits() would
  // reject a zero/negative amount, and there's nothing to grant.
  if (claimed.credits > 0) {
    await grantCredits(claimed.userId, claimed.credits, {
      type: claimed.kind === 'subscription' ? 'subscription_grant' : 'purchase',
      description: `Purchase — ${claimed.packName}`,
      teamId: claimed.teamId,
      orderId: claimed.id,
      idempotencyKey: `order:${claimed.id}`,
      meta: { reference: claimed.reference, kind: claimed.kind },
    });
  }

  return 'granted';
}

/** Cost of one completion, from real token usage. */
export function costForTokens(
  registry: ProviderRegistry,
  provider: ProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = creditsPer1k(registry, provider, model);
  return Math.max(MINIMUM_CHARGE, Math.ceil(((inputTokens + outputTokens) / 1000) * rate));
}

/** Recomputes a team's wallet balance from the transaction log — the log is the source of truth. */
export async function recomputeBalance(teamId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${creditTransactions.amount}), 0)::int` })
    .from(creditTransactions)
    .innerJoin(creditWallets, eq(creditWallets.id, creditTransactions.walletId))
    .where(eq(creditWallets.ownerId, teamId));

  return row?.total ?? 0;
}

/** The balance a user actually sees — their team's wallet, not a per-user number. */
export async function getBalanceForUser(userId: string): Promise<number> {
  const teamId = await teamIdForUser(userId);
  const [wallet] = await db.select({ balance: creditWallets.balance }).from(creditWallets).where(eq(creditWallets.ownerId, teamId)).limit(1);
  return wallet?.balance ?? 0;
}

export async function getBalanceForTeam(teamId: string): Promise<number> {
  const [wallet] = await db.select({ balance: creditWallets.balance }).from(creditWallets).where(eq(creditWallets.ownerId, teamId)).limit(1);
  return wallet?.balance ?? 0;
}
