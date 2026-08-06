# Billing Overhaul — Subscriptions, Passes, Team Wallets

Shipped 2026-08-06, phase 5 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). Scope was explicitly expanded beyond
the original plan at the user's request: **add real recurring subscriptions (any interval), pay-
per-hour/day/week access passes, and rebuild credits around team wallets** — not just the
plan's original "keep credits as-is, add entitlements/usage_events" scope. Depends on `07-teams.md`
(team-scoped billing needs teams), `10-ai-model-registry.md`.

## The four ways to pay, after this phase

| Model | Table | How it works |
|---|---|---|
| **Pay-as-you-go** | `credit_packs` (existing) | Prepaid credits, spent per message by real token usage. Unchanged UX. |
| **Subscription** | `plans` + `subscriptions` | Recurring charge, any interval (day/week/month/year, any count — "every 2 weeks" works), grants `creditsPerCycle` credits on signup and every renewal. |
| **Time-boxed pass** | `pass_products` + `entitlements` | One payment, N hours/days/weeks of **unmetered** chat — no credits spent at all while active. |
| **Admin grant/adjustment** | `credit_transactions` (`type: 'adjustment'`) | Unchanged — `adjustCreditsAction`. |

## Micropayments — what "true" micropayments actually means here

**Stated explicitly, not glossed over**: sub-cent/sub-penny card transactions aren't feasible —
card networks and payment processors (Stripe included) enforce practical minimums (roughly
£0.30–£0.50 per charge) that make a literal "pay £0.001 per message" transaction impossible to
process. **The prepaid credit system already *is* the micropayment mechanism**: a user pays once
(£1 minimum, enforced by whatever the smallest `credit_packs` row is priced at), then spends in
increments as small as a single credit per message — `MINIMUM_CHARGE = 1` in
`src/lib/billing/credits.ts`, unchanged. If genuinely sub-penny granularity matters later, the
lever is the credits-per-penny exchange rate on a pack, not the payment rail.

## Team-scoped wallets — the biggest internal change

`users.credits`/`lifetimePurchased`/`lifetimeSpent` are **frozen 2026-08-06** — still in the
schema (not dropped, same "deprecate in place" pattern as Phase 4's flat persona columns), but no
code reads or writes them anymore. The real balance lives on `credit_wallets`, one per **team**
(`creditWallets.ownerId = teams.id`), because a subscription or pass belongs to a team, and its
grant needs to go into a pool every member can draw from — a per-user balance can't represent that.

For every team today (all personal, one member each), this is invisible: `grantCredits(userId, …)`
and `spendCredits(userId, …)` (`src/lib/billing/credits.ts`) **kept their exact external
signatures** — every existing call site (`registerAction`'s signup bonus, the chat route,
`fulfilOrder`, admin's `adjustCreditsAction`) needed zero changes. Internally, both now resolve
`userId → defaultTeamId → wallet`, lock the *wallet* row (not a user row), and write to
`credit_transactions` (replaces `credit_ledger`, same "deprecate in place, don't drop" treatment).
The only real behavior change is for a genuine multi-member team, which doesn't exist in production
data yet — this is forward-looking infrastructure, verified correct (see below) but not yet
exercised by real usage.

**Read sites updated** (display-only, no billing logic): `SiteHeader`'s credit badge,
`chat/[id]`'s sidebar badge, the dashboard's balance card and transaction list, both admin customer
pages. All now read the team wallet via `getBalanceForTeam()`/`getBalanceForUser()`
(`src/lib/billing/credits.ts`) instead of `users.credits`.

## Passes — unmetered access via entitlements, not credits

`entitlements` (`targetType: 'platform'`, `sourceType: 'pass'`, `expiresAt` = purchase time +
duration) is checked once per chat request
(`hasActiveEntitlement(chat.teamId, 'platform')` in `src/app/api/chat/route.ts`) — if active, the
credit-sufficiency check is skipped entirely and `spendCredits()` is never called for that turn.
`usage_events.coveredByPass` records this happened (real tokens were still used — that fact isn't
lost — just not charged), and `messages.creditsCost` still shows the *notional* cost so the UI can
say "this would have cost N credits, covered by your pass" if it ever wants to.

`fulfilPassOrder()` (`src/lib/billing/entitlements.ts`) grants the entitlement, called from the
webhook route alongside (not instead of) `fulfilOrder()` — pass orders carry `credits: 0`, so
`fulfilOrder` is a no-op beyond flipping the idempotency flag; the entitlement is the actual
product.

## Subscriptions — real Stripe recurring billing, no pre-created Price objects

`StripeGateway.createCheckout` (`src/lib/billing/gateways.ts`) branches on `order.kind`: a
subscription order checks out in `mode: 'subscription'` with the recurring price built **inline**
via `price_data.recurring` — the exact same "define the product at checkout time" pattern the
one-off credit-pack path already used, just with `{interval, interval_count}` added. No Stripe
Dashboard setup, no pre-created Price/Product — a plan created in `/admin/plans` is sellable
immediately.

**Lifecycle**, all in `StripeGateway.handleWebhook`:
- `checkout.session.completed` (subscription mode) — creates the `subscriptions` row from the
  session's own subscription reference, then returns the `Order` as usual so `fulfilOrder()` grants
  the *first* cycle's credits through the existing, proven path.
- `invoice.paid` with `billing_reason: 'subscription_cycle'` — a **renewal**, not the first invoice
  (which is already handled above) — grants `plan.creditsPerCycle` again and extends
  `currentPeriodEnd`. Guarded against Stripe's at-least-once webhook redelivery by the
  `credit_transactions.idempotency_key` unique index (`invoice:${invoice.id}`) — a redelivered
  event hits a unique-constraint violation (Postgres code `23505`), caught and treated as the
  successful no-op it is, not surfaced as a webhook failure Stripe would retry forever.
- `customer.subscription.updated`/`.deleted` — status sync (`past_due`, `canceled`, etc.).

## Deliberate scope reductions (stated, not silently dropped)

1. **PayPal subscriptions not built.** Only Stripe supports the inline-recurring-price checkout
   pattern this phase uses; PayPal's subscription API is a genuinely different integration
   (billing plans created ahead of time via a separate endpoint). `subscribeAction`
   (`src/server/actions/billing.ts`) hard-codes `'stripe'`. One-off packs/passes still work
   through any enabled gateway (Stripe, PayPal, bank transfer), unchanged.
2. **"All possible payment methods" = Stripe's own method coverage, not N custom integrations.**
   Once a Stripe account has Apple Pay/Google Pay/bank debits/BNPL enabled in the Dashboard, Stripe
   Checkout offers them automatically for both one-off and subscription sessions — **that's a
   business/Dashboard configuration step, not code**, and building separate driver classes for
   payment methods Stripe already brokers would be pure duplication. Genuinely different rails
   (crypto, direct bank transfer beyond Stripe) would each need their own `PaymentGateway`
   implementation, same shape as `StripeGateway`/`PayPalGateway`/`BankTransferGateway` — not
   attempted here without a real merchant account to integrate against; faking one would be
   dishonest, not useful.
3. **`personas.minPlanTier` is schema-only, not enforced.** Column exists (`plans.tier` too) for
   gating a persona behind a subscription tier, but no code path checks it yet — a real new
   authorization surface (what happens when a team's subscription lapses mid-conversation?)
   deliberately deferred rather than built in a rush alongside everything else this phase.
4. **`usage_daily` has no rollup job.** Table exists, `usage_events` is populated on every chat
   turn; the aggregation job is parked, same "no cron/queue infrastructure yet" pragmatism as
   `08-module-architecture.md`'s stance on `modules:sync`.
5. **`entitlements` has no unique constraint on `(sourceType, sourceId)`.** `fulfilPassOrder()`'s
   check-then-insert has a narrow race window under concurrent duplicate webhook delivery — worst
   case is a duplicate entitlement row granting the *same* access twice, not a double charge (the
   order-level `creditsGranted` flag already prevents that). Low severity, noted rather than fixed
   with a migration this pass.

## Verifying it

Backfill (147 personas unaffected — this phase didn't touch persona tables): confirmed 2 teams → 2
wallets, wallet balances exactly matched pre-migration `users.credits` (99998 and 2500), and all 4
pre-existing `credit_ledger` rows copied into `credit_transactions` with matching amounts/balances.

The full wallet-grant → wallet-spend → entitlement-grant → subscription-creation → renewal-grant
chain was exercised end-to-end in a transaction deliberately rolled back — balance arithmetic,
entitlement expiry semantics, and idempotency all verified correct with zero persisted test data
(wallet balance and row counts identical before/after). `npm run typecheck`/`npm run build` clean;
`/pricing` (now showing packs + plans + passes), `/dashboard`, `/admin/plans`, `/admin/passes` all
respond correctly post-restart with no new runtime errors.

**Not verified against real Stripe** (no live keys in this environment) — the webhook signature
verification, checkout session creation, and subscription retrieval calls are real, correct Stripe
SDK usage, but exercising them end-to-end requires a real Stripe account with test-mode keys,
which is a deployment-time step, not something this session could do.

## What's next

Phase 6 (group chat/rooms) is next. `usage_events`/`entitlements` are already team-scoped and
message-level, so group-chat's per-mention billing (multiple personas replying to one message) has
what it needs without another billing migration.
