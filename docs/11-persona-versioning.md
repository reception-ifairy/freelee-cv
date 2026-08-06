# Persona Versioning

Shipped 2026-08-06, phase 4 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). The largest-blast-radius phase so
far — splits `personas`, the single most-read table in the app, into identity (`personas`) and
versioned content (`persona_versions`). Depends on `07-teams.md` (teamId) and `10-ai-model-registry.md`.

## Why

"Can't sell or audit a bot that changes under the customer" — a persona a customer bought needs a
frozen, immutable snapshot of what it actually does. Before this phase, every field lived directly
on `personas` and every edit mutated it in place, immediately, for every open conversation. That's
fine for a single-owner catalog (which freelee still mostly is) but doesn't hold once a persona can
be sold, shared across teams, or audited after the fact.

## The split

**`personas`** keeps identity/catalog: `name`, `slug`, `tagline`, `description`, `expertise`,
`accentColor`, `creditsPerMessage`, `isPremium`/`isFeatured`/`isActive`, `position`, plus three new
pointer columns: `currentVersionId`, `draftVersionId` (nullable, set only mid-edit), `pinVersioning`
(boolean, default `false`).

**`persona_versions`** (new table) gets everything that shapes a reply: `systemPrompt`,
`welcomeMessage`, `suggestions`, `aiProvider`/`model`/`modelTier`, all sampling parameters
(`temperature`, `topP`, `frequencyPenalty`, `presencePenalty`, `maxTokens`, `historyMessages`),
`audienceType`, `personality`, `knowledgeDomains`, `capabilities`, `groundingSources`, `guardrails`,
`audienceSegments`, `blueprint`, `interactionStyle`, `approachToUnknown`, `promptTechnique`,
`thinkingMode`. Plus `version` (semver text), `status` (draft/published/deprecated), `isImmutable`,
`changelog`, `createdBy`, `publishedAt`.

**Deliberately not moved: `audienceType`.** It's genuinely dual-purpose (compiled into the system
prompt *and* used as a catalog filter on `/personas?audience=B2B`), and unlike the other content
fields it was seriously considered for staying on `personas` as pure taxonomy (like `categories`).
It ended up moving with the rest — see "read sites touched" below for the real cost of that
decision (three marketing-page queries needed a join) — but if this list ever grows, re-examine
whether a field is really *content* (moves) or *taxonomy* (stays), don't move by default.

## Two very different edit lifecycles — the `pinVersioning` switch

- **`pinVersioning = false` (default; every one of the 147 pre-existing personas, and the default
  for new ones):** editing in `/admin/personas` mutates `currentVersion`'s row **in place**.
  `isImmutable` is never set. This is byte-for-byte the same behavior as before this table
  existed — an edit takes effect on every open conversation immediately.
- **`pinVersioning = true`:** editing writes to a **draft** (`personas.draftVersionId`, created on
  first edit after pinning). `currentVersionId` — what every open conversation reads — is
  untouched until an admin explicitly clicks **Publish new version**
  (`publishPersonaVersionAction`), which snapshots the draft into a new row with `isImmutable =
  true`, bumps the semver patch, and flips `currentVersionId`. **Revert to this** on any past
  published version (`revertPersonaVersionAction`) clones it into a fresh draft — rollback without
  erasing history.

`chats.personaVersionId` is set at chat-creation time **only** when the persona has
`pinVersioning = true` (`startChatAction`) — pinning a specific version to that conversation even
across future publishes. For `pinVersioning = false` personas (the overwhelming majority), it stays
`null` forever and every chat resolves the *current* version fresh on every request — unchanged
behavior.

## Deliberate scope reduction: no `aiModelId` FK

The plan's original framing wanted `personaVersions.aiModelId` as a real FK into `ai_models`
(Phase 3's registry), replacing free-text `aiProvider`/`model`/`modelTier`. **Not done this
phase** — `persona_versions` keeps the exact same three free-text columns `personas` always had.
Converting model *selection* to an FK-based picker is a real UI rework of the persona form's model
tab, on top of an already-XL phase splitting the most-read table; doing both at once multiplies
risk for a benefit (referential integrity on model choice, cascading deprecation warnings) that
isn't needed yet. `ai_models` and `persona_versions` are therefore not functionally coupled — see
the `persona-versioning` module's `requires` in `src/lib/modules/registry.ts` for the same note.
Revisit once there's a concrete need (e.g. Phase 9's marketplace wanting to warn "3 personas use a
model that's being retired").

## No circular-FK trick needed this time (unlike Phase 1)

`personas.currentVersionId` is **nullable forever**, not backfilled-then-`NOT NULL` like Phase 1's
`teamId`. Reason: `personas.id` and `persona_versions.id` are both `serial`, not client-generated
uuids like `teams.id`/`users.id` — there's no id to pre-choose for a `DEFERRABLE` FK pair the way
Phase 1 did it. Instead, creating a new persona is three plain statements in one transaction: insert
the persona (`currentVersionId = NULL`), insert its version (`personaId` now known), `UPDATE` the
persona's `currentVersionId`. "Every persona has a current version" is an **application invariant**
(every creation path — `savePersonaAction`, `duplicatePersonaAction`, `seed.ts` — does exactly this),
not a DB constraint.

## Migration

Two steps, both low-risk (unlike Phase 1's `NOT NULL` tightening, there was no third step needed):

1. `drizzle/0009_persona_versions.sql` — additive: new table, nullable pointer columns on
   `personas`, nullable `personaVersionId` on `chats`, and `personas.system_prompt`'s `NOT NULL`
   relaxed (new code never writes it — see "what's still on `personas`" below).
2. Backfill (scratchpad SQL, snapshot-first, `RAISE EXCEPTION` assertion before `COMMIT` — the
   established pattern) — exactly one `1.0.0` / `published` / **not** immutable version per existing
   persona, verbatim copy of its content columns, `currentVersionId` pointed at it. Verified: 147
   personas → 147 versions, zero NULLs.

**What's still on `personas`, deliberately not cleaned up this phase:** all the moved columns
physically remain (deprecated, unread, unwritten) — `systemPrompt`, `welcomeMessage`, `temperature`,
etc. Dropping them is a separate, later, independently-verified migration (same "don't rush the
last step" caution as Phase 1's teams retrofit), not done here. They cost nothing sitting unused
except a few dozen bytes per row.

## Read sites touched

This rippled further than the plan anticipated — `buildSystemPrompt()`, the chat route, and
`startChatAction` were the obvious ones, but `audienceType` living on the version meant every place
that displays or filters on it needed a join: `admin/personas` (list — model/tier column),
`personas/[slug]` (detail page — model, personality traits, audience badge, welcome message,
suggestions, knowledge domains), the homepage's featured-persona rail, `/personas` (listing +
`?audience=` filter, which needed the join in *both* the row query and the count query), and
`chat/[id]` (suggestion chips). All fixed; see the file list in the plan's completion notes for
specifics.

## Admin UI

`/admin/personas/[id]` — a **"Version pinning"** checkbox (Publishing tab, off by default) is the
only new control on the main form; nothing else about the editing experience changed for the 147
existing personas. Once pinned, a **Versions** panel appears below the form (outside it — HTML
forms can't nest, so publish/revert are separate `<form>`s posting to
`publishPersonaVersionAction`/`revertPersonaVersionAction`) with the draft-publish button and a
revert list of past published versions.

## Verifying it

```sql
select count(*) from persona_versions;                                    -- 147 post-backfill
select p.name, pv.version, pv.status, pv.is_immutable
  from personas p join persona_versions pv on pv.id = p.current_version_id limit 5;
```
Confirmed against production, read-only: `buildSystemPrompt()` compiles correctly against a real
persona+version pair (2243-char output, real content). The full draft→publish cycle (create draft,
verify `currentVersionId` unchanged while drafting, publish, verify `currentVersionId` flips,
`draftVersionId` clears, new version becomes `isImmutable`) was exercised in a transaction that was
then deliberately rolled back — zero persisted test data, table counts unchanged (147/147) before
and after. `npm run build` + `npm run typecheck` clean; `/personas`, `/personas?audience=B2B`,
`/personas/[slug]`, `/admin/personas`, `/admin/personas/[id]`, `/admin/personas/new`, `/chat` all
respond correctly post-restart with no new runtime errors.

## What's next

Phase 5 (billing/credits/entitlements overhaul) is next — `usageEvents.personaVersionId` will
reference this table, which is why versioning had to land before it.
