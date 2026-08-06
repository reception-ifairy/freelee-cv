# Marketplace

Shipped 2026-08-06, phase 9 — the last, most optional phase of the "AI Bot Marketplace UK"
concept integration (`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). The plan flagged
this explicitly as a later go/no-go, not part of the committed roadmap: freelee's existing public
`/personas` catalog + shipped UK taxonomy already **is** the concept doc's "Stage A single-creator
catalog." This phase is Stage B/C only — external vendors (other teams) listing personas for
installation into a different team's own catalog.

## The core idea

A vendor is a team, not a separate concept — the same "teams are the tenant boundary" choice this
whole integration has made since Phase 1. A listing points at one of that team's own personas.
Installing a listing **clones** the vendor's current published persona version into a brand-new
persona the installing team fully owns — not a live reference, not a shared row. That clone is
where `personaVersions.authoredByTeamId` (the one schema change this phase needed) gets set to the
vendor's team, permanently recording true authorship separately from current ownership.

## The redaction hook, finally reachable

`docs/15-data-portability.md` built `redactSystemPrompt()` back in Phase 8, correct but
structurally unreachable — every persona a team could export was necessarily its own. This phase
is the first thing that makes the check actually fire: `installListing()`
(`src/lib/marketplace/install.ts`) is the **only** code path in this entire app that ever sets
`personaVersions.authoredByTeamId` to a team other than the persona's own `teamId`. Verified
directly: exporting the installing team's data now correctly nulls the cloned version's
`systemPrompt` (`instructionsRedacted: true`); exporting the *vendor's own* copy of the same
content does not — redaction is directional, not a blanket rule on the persona.

## Scoped down hard: two pricing models built, two deferred, real money never moved

The plan's own `pricingModel` list is `free | one_off | subscription | credit_markup`. Only `free`
and `credit_markup` are installable this phase:

- **`free`** — trivial, no payment step.
- **`credit_markup`** — the vendor earns a percentage of the credits the installed persona already
  charges the installing team, computed *after the fact* from `usageEvents`, not as an added
  surcharge collected at chat time. This is the single most consequential scope decision in this
  phase: it means installing (and using) a `credit_markup` persona needed **zero changes** to
  `src/app/api/chat/route.ts` — the single most sensitive, heavily-exercised code path in the
  entire app. Revenue share is a reporting/payout concern, computed by
  `src/lib/marketplace/payouts.ts` scanning history, not a billing-hot-path concern.
- **`one_off`/`subscription`** — schema-ready (`listings.priceCents`, `pricingModel` enum values
  exist) but **not installable**: `installListing()` throws for both, and the create-listing form
  disables them. Real reasons, not just "ran out of time": a one-off/subscription purchase from a
  vendor needs a real checkout, and for any of that money to ever leave the platform to a genuinely
  external vendor, it needs a real Stripe Connect account. Building a purchase flow whose payout
  side is fictional felt worse than being explicit it doesn't exist. Revisit together with real
  Stripe Connect if this is ever prioritized.

**Real Stripe Connect account creation and real payout transfers were not built at all** — not
scaffolded, not stubbed, nothing. `vendors.stripeConnectAccountId` is a schema-ready nullable
column with zero code ever writing to it. `payouts` are **computed records of what's owed**
(`status: 'pending'`, `stripeTransferId` always null) — a preview a platform admin can generate
on demand, never a real money movement. This is a deliberately bigger, more conservative scope cut
than any earlier phase's — every other phase's cuts were about engineering effort or polish; this
one is specifically about not writing code that could ever unintentionally move real money to a
real external party without a human directly authorizing that specific transfer. `CREDIT_VALUE_CENTS`
(`src/lib/marketplace/payouts.ts`) is a fixed blended rate (0.18¢/credit, the entry-level credit
pack's own rate) for turning credits into a payout preview amount — not read dynamically, since
nothing downstream of it executes a real transfer anyway.

## What "install" actually copies

`personas` has two kinds of fields: identity (name, tagline, avatar, ...) and a long tail of
columns deprecated since Phase 4 (`systemPrompt`, `model`, `personality`, `guardrails`, ...) that
new code never reads — the real content lives on `personaVersions` now. `installListing()` copies
identity fields from the vendor's `personas` row and everything content-bearing from the vendor's
current `personaVersions` row — never from the deprecated flat columns, which would silently carry
stale/unused data. The clone deliberately does **not** inherit `isFeatured`, `isPremium`,
`creditsPerMessage`, or `minPlanTier` — those are the platform's own merchandising/gating concepts
for the *original* persona's catalog listing, not something an installed copy should carry into a
different team's catalog.

## Moderation: manual only

`listings.status`: `draft -> pending_review -> approved | rejected`, plus `suspended` for pulling
a live listing. A vendor submits; a platform admin (`/admin/marketplace`, gated by `requireAdmin()`
same as every other admin surface) approves, rejects with a note, or suspends. No automated
first-pass moderation — matches the plan's own "manual-only admin queue for the MVP" call.

## Reviews

One review per (listing, installing team) — `listingReviews`, gated to teams that have actually
installed the listing (`reviewListingAction` checks `listingInstalls` first). `listings.ratingAvg`/
`ratingCount` are denormalized and recomputed on every review write, not a live aggregate query —
consistent with `conversations.messageCount`/`costTotal`-style counters used everywhere else in
this app for cheap, frequently-read numbers.

## Entry points

- **Public browse**: `/marketplace` (approved listings), `/marketplace/[id]` (detail, install
  button, reviews).
- **Vendor self-service**: `/dashboard/vendor` — become a vendor, create/submit listings, gated by
  a new `team.manage_marketplace` permission (owner/admin by default,
  `src/lib/permissions.ts`).
- **Admin moderation**: `/admin/marketplace` — approve/reject/suspend, plus an on-demand payout
  computation form (vendor + date range -> a `payouts` row).

Registered **core** (`isCore: true`, not team-disableable) in the module registry — commerce
infrastructure like the AI model registry and billing overhaul, not an optional feature a team
opts into.

## Verifying it

Migration `0014_marketplace.sql` — one enum value added to `entitlement_source_type`, one nullable
column on `persona_versions`, five new tables. `npm run typecheck`/`npm run build` clean;
`npm run modules:verify` — 8 modules registered, all dependencies resolve; every new route present
in the build output and correctly redirects signed-out visitors.

End-to-end against production with two fresh scratch teams (a real vendor + a real installer — the
actual cross-team scenario, not installing back into the same team): vendor team created a real
persona with a real `systemPrompt`, listed it (`credit_markup`, 20%), approved it. Installed it
into the installer team — confirmed the clone is genuinely owned by the installing team, its
version's `authoredByTeamId` correctly points at the vendor, and the `systemPrompt` was copied
byte-for-byte. Confirmed `listing_installs_unique_idx` really blocks a second install of the same
listing by the same team (a real Postgres `23505` unique-violation, not just application logic).
Confirmed Phase 8's redaction fires for the install (exported `systemPrompt: null`,
`instructionsRedacted: true`) and does **not** fire for the vendor exporting its own persona
(directional, not blanket). Inserted a real `usageEvents` row against the installed persona and
computed a real payout: 10 credits charged × 20% markup × 0.18¢/credit ≈ 0¢ (correctly rounds down
at this small a test volume — matches the hand-computed expected value exactly). Deleted both
scratch teams and everything under them — confirmed zero residue.

One verification-script bug surfaced and fixed *during* verification, not shipped-code: the first
duplicate-install check used a string-matching heuristic on the caught error that never matched
Drizzle's actual wrapped error shape (the real Postgres error code lives under `.cause.code`, not
top-level `.code`) — silently reporting a false failure. Fixed to check `error.cause.code === '23505'`
directly; the underlying database constraint was correct the entire time.

## What's explicitly not here

No real Stripe Connect onboarding, no real payout transfers, no one_off/subscription checkout, no
automated moderation, no persona un-installation/uninstall flow, no vendor payout dashboard beyond
the admin's on-demand preview. This is the full committed roadmap (Phases 1–8) plus a genuinely
working, honestly-scoped first cut of the optional Phase 9 — not a finished commerce platform.
