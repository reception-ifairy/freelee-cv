# Database & Schema

Single Postgres database (`aigency_freelee`), Drizzle ORM, schema defined entirely in
`src/db/schema.ts`. **Multi-tenant since 2026-08-06** — every user belongs to a `team`
("workspace"), with the pre-existing single owner's team as the platform-wide catalog owner. See
`07-teams.md` for the model and migration; this page's table map below reflects the current
(post-teams) shape. (The dead legacy tree's `org_id`-everywhere schema predates and is unrelated
to this — it was a different, abandoned design, not an ancestor of the current teams model.)

## Table map

| Table | Purpose |
|---|---|
| `users`, `accounts`, `verification_tokens` | Auth.js identity + credits balance on `users`; `users.defaultTeamId` is the active workspace |
| `teams`, `team_members`, `team_invitations` | Workspaces — billing/isolation unit, roles (owner/admin/member/guest), invites. See `07-teams.md` |
| `categories` | Top-level persona/market categories (20 rows, UK-market taxonomy — see `05-uk-taxonomy.md`) |
| `sectors` | Sub-categories under `categories`, B2C/B2B/B2G suitability scoring (103 rows) |
| `personas` | Identity/catalog only since 2026-08-06 (Phase 4) — `teamId` (ownership), `visibility` (browsability), `currentVersionId`/`draftVersionId`/`pinVersioning`. Content moved to `persona_versions`. See `11-persona-versioning.md` |
| `persona_versions` | Prompt/model/parameter content — system prompt, sampling params, personality, guardrails, blueprint. One row per version; `isImmutable` once published. See `11-persona-versioning.md` |
| `persona_categories` | Junction: persona ↔ category (many-to-many) |
| `prompt_modifiers` | Reusable tone/writing/output/length/audience snippets, toggleable per chat |
| `chats`, `messages` | Conversation threads and their messages. `chats.teamId` since 2026-08-06 (guest chats attribute to the platform team) |
| `credit_packs`, `orders` | Pay-as-you-go packs + all orders (packs/subscriptions/passes — `orders.kind`). `credit_ledger` deprecated 2026-08-06, see `credit_transactions` below |
| `plans`, `subscriptions` | Recurring billing, any interval — added 2026-08-06. See `12-billing-overhaul.md` |
| `pass_products`, `entitlements` | Time-boxed access passes + the durable/expiring access grants they (and subscriptions) create — added 2026-08-06 |
| `credit_wallets`, `credit_transactions` | Team-scoped balance + append-only log — replaces `users.credits`/`credit_ledger` (both frozen, not dropped) since 2026-08-06 |
| `usage_events`, `usage_daily` | Raw per-call usage facts (populated) + a daily aggregate (parked, no rollup job yet) — added 2026-08-06 |
| `posts`, `tags`, `post_tags` | Blog |
| `pages` | Static admin-editable pages (About, Terms, Privacy) — rendered at `/[slug]` |
| `menu_items` | Header/footer/legal nav, admin-editable |
| `seo_settings` | Per-route SEO overrides |
| `settings` | Generic key/value runtime config (site name, AI keys, homepage copy — see below) |
| `themes` | Design tokens (brand/accent colors) injected as CSS variables at request time |
| `activity_log` | Admin action audit trail, shown on the dashboard |

## `personas` — the core entity

**Since 2026-08-06 (Phase 4), the fields below live on `persona_versions`, reached via
`personas.currentVersionId`** — not on `personas` directly. Kept here as the field-level reference
(the split doesn't change what each field means, only which table it's in); see
`11-persona-versioning.md` for the split itself and why.

Columns worth knowing beyond the obvious (`name`, `slug`, `systemPrompt`, `welcomeMessage`):

- **Ownership vs. browsability** (added 2026-08-06): `teamId` (who can edit — every pre-existing
  persona belongs to the platform team) is independent of `visibility`
  (`'private'|'team'|'unlisted'|'public'`, who can browse/chat with it — every pre-existing persona
  defaults to `'public'`, so the catalog was unaffected by this column's introduction). See
  `07-teams.md`.
- **Model selection**: `aiProvider` (text, default `'openai'`), `model` (text, nullable — explicit
  model id), `modelTier` (text, nullable — `'fast'|'balanced'|'advanced'`, mutually exclusive with
  `model`; resolved live against `src/lib/ai/registry.ts` at chat time). See `02-ai-models.md`.
- **Personality**: `personality` (jsonb, trait → 0-100 score), `interactionStyle` (enum — *tone*:
  formal/casual/enthusiastic/concise/socratic), `promptTechnique` (enum: direct/chain_of_thought),
  `approachToUnknown` (enum).
- **Capabilities**: `capabilities` (jsonb, flat booleans — vision, images, voice in/out, share, copy,
  embed, suggestions, badword filter, tone/writing/output selectors). Note: `badwordFilter` is stored
  but read nowhere at runtime — no keyword filtering exists in code.
- **Grounding**: `groundingSources` (jsonb `string[]` of keys from `src/lib/knowledge/registry.ts`) —
  gates which knowledge base gets searched before a reply.
- **Guardrails & targeting** (added 2026-08-03): `guardrails` (jsonb `string[]` of codes from
  `src/lib/persona/guardrails.ts`, compiled into the system prompt), `audienceSegments` (jsonb
  `string[]` of codes from `src/lib/persona/audience-segments.ts`, admin/data only — not yet wired
  into behavior). See `05-uk-taxonomy.md`.
- **`blueprint`** (jsonb, nullable, `PersonaBlueprint` type): an optional deep cognitive schema
  (identity, personality/narrative profile, communication profile, interaction/pedagogy profile,
  `contentIntegrityAndSafety`, `finalStatements.disclaimerOrSafetyNotes`) compiled ahead of
  `systemPrompt` when present. Edited as raw JSON in the admin persona form's `prompt` tab.

## Enums

Declared together near the top of `schema.ts`, with the house rule spelled out in a comment there:
*"Enums live in the database, not as loose strings, so an invalid status is rejected by Postgres
rather than only by application code."* Current enums: `orderStatus`, `ledgerType`, `messageRole`,
`messageStatus`, `modifierType`, `menuLocation`, `menuVisibility`, `audienceType` (B2B/B2C/B2G),
`settingType`, `interactionStyle`, `approachToUnknown`, `promptTechnique`, `riskLevel` (R0-R3),
`narrativeFit` (low/medium/high/very_high), `teamRole` (owner/admin/member/guest), `teamAiMode`
(platform/byok/hybrid), `personaVisibility` (private/team/unlisted/public) — added 2026-08-06, see
`07-teams.md` — plus `moduleType`/`moduleStatus` (`08-module-architecture.md`),
`aiModelStatus`/`credentialScope` (`10-ai-model-registry.md`), and `personaVersionStatus`
(`11-persona-versioning.md`), all also 2026-08-06.

**Exception, deliberate**: `personas.modelTier` is plain `text`, not an enum — chosen specifically to
avoid a `CREATE TYPE`/`ALTER TYPE` migration whenever the model lineup changes. `riskLevel`/
`narrativeFit` *are* real enums because they're small, genuinely closed UK-regulatory vocabularies
that won't grow the way model names do.

## `settings` — generic runtime config

Key/value table (`key`, `group`, `value`, `type`, `label`, `isPublic`, `position`), read via
`src/lib/settings.ts` (`getSettingString`/`getSettingBool`/`getSettingInt`, all cached per-request via
React's `cache()`). Adding a new setting is a one-line addition to `src/lib/settings-schema.ts`'s
`SETTINGS_SCHEMA` — no migration, no new admin page. Groups in use: `general` (site name/description),
`homepage` (hero/CTA copy, editable at `/admin/settings?group=homepage`), `ai` (provider keys/default
models — has its own dedicated `AiSettingsForm` UI, not the generic form), `billing`, `analytics`.

## `themes` — visual design tokens

One active row's `tokens` (jsonb: `brand-500`, `accent-500`, etc.) is injected as a `:root { --color-*:
... }` `<style>` block in the root layout at request time — the whole public site re-skins without a
rebuild. Edited at `/admin/theme`. **Does not affect `/admin` itself** — the admin console has its own
separate, hardcoded dark "developer console" identity (cyan accent, true black) scoped via an
`.admin-console` class, deliberately independent of the public brand tokens. See `03-admin-panel.md`.
