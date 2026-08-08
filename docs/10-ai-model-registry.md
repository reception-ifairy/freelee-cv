# AI Model Registry

Shipped 2026-08-06, phase 3 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). Replaces the static `PROVIDERS` const
that used to live in `src/lib/ai/registry.ts` with `ai_providers`/`ai_models` DB tables — "new model
= INSERT, zero deploy," the concept doc's core principle for this piece, now actually true here.

## What changed, concretely

`src/lib/ai/registry.ts` keeps the same exported **types** (`ProviderId`, `ModelTier`, `ModelInfo`,
`ProviderConfig`, `ResolvedKeys`) and almost the same function names, but every function that used
to read the module-level `PROVIDERS` constant now takes a `registry: ProviderRegistry` as an
explicit first parameter — `resolveTierModel(registry, ...)`, `getModel(registry, ...)`,
`creditsPer1k(registry, ...)`, `providerIsConfigured(registry, ...)`. The registry itself comes from
the new `getProviderRegistry()`, an async function (DB query) cached per-request via React's
`cache()` — call it once near the top of a request/page, thread the result through.
`resolveProviderId()`/`isProviderId()`/`isModelTier()` are unchanged (pure, no DB access needed).

This is a **narrower claim than "keep the exact same signatures"** — the plan's original framing —
because `PROVIDERS` wasn't only read from server-only call sites. `src/components/admin/persona-form.tsx`
and `src/components/admin/ai-settings-form.tsx` are client components that read it directly for
`<select>`/`<datalist>` options; a DB-backed registry can't be read synchronously from a client
component. Both now take a `providers: ProviderRegistry` **prop**, fetched server-side by their
parent pages (`admin/personas/{new,[id]}/page.tsx`, `admin/settings/page.tsx`) and passed down —
ordinary server-component-fetches-then-passes-to-client-component, not a new pattern for this app.

## Deliberate scope reductions (stated, not silently dropped)

1. **Providers stay a fixed TypeScript union** (`'openai' | 'anthropic' | 'openrouter' | 'ollama'`),
   not a fully dynamic DB-driven set. `ai_providers` rows exist and are admin-editable (default
   model, active flag), but adding a 5th provider still needs a new driver branch in `getModel()`
   — same distinction the concept doc itself draws between its `LlmDriver` contract (code) and
   `ai_models` catalog (data). Only **models** are the fully dynamic part.
2. **Flat `creditsPer1k`**, not the concept doc's separate input/output-token pricing. Matches what
   was actually there before (today's static config had one number per model) and Phase 5's own
   already-stated decision not to adopt fine-grained token-tier pricing yet — introducing it here
   ahead of Phase 5 needing it would be speculative.
3. ~~No live sync against provider APIs~~ **Superseded 2026-08-08** — `/admin/ai-models` now has a
   "Fetch models" button per provider (`src/lib/ai/fetch-models.ts`, `fetchProviderModelsAction`/
   `importFetchedModelsAction` in `admin-ai-models.ts`). Each provider's real endpoint is called
   live — OpenAI/Anthropic/OpenRouter/Ollama's `/v1/models` (or native equivalent), Stability's
   `/v1/engines/list` — with the same key-resolution order `getModel()` uses (settings table, then
   `process.env[apiKeyEnv]`), a 5s timeout, and a never-throws contract (same posture as
   `src/lib/knowledge/registry.ts`'s `search()`). Results render as a checkbox grid the admin picks
   from; imported rows land as `status: 'preview'` (a meaningful use of the existing enum — freshly
   fetched, not yet priced/vetted) for the admin to tier/price via the existing inline edit row.
   This directly replaces hand-typing model ids — provider catalogs change often enough that
   nobody should be maintaining that list by hand, including Claude.
4. **`ai_model_team` and `provider_credentials` are parked** — tables exist (so Phase 5 doesn't need
   another migration), but nothing reads or writes them yet. BYOK and per-team model
   allowlist/markup are Phase 5's job.

## Migration

Purely additive (`drizzle/0008_ai_model_registry.sql` — four new tables, nothing existing touched),
applied directly (no nullable→backfill→NOT NULL dance needed, unlike Phase 1 — no live table was
altered). Seeded via `npx tsx scripts/seed-ai-models.ts`, verified to reproduce the old static
config exactly (4 providers, 7 models, same ids/tiers/pricing) before any call site was switched
over.

## `/admin/ai-models`

New admin page (`src/server/actions/admin-ai-models.ts` — named without a `admin/` subdirectory
because `src/server/actions/admin.ts` already exists as a **file**, and turning it into a directory
is a bigger refactor than this phase warrants; same file-vs-directory workaround already used for
`src/lib/permissions.ts` vs. `auth.ts`). Per provider: default model + active flag, "Fetch models"
(see above), and an inline-editable list of its models (tier, status, credits/1k, sort) — split into
"Chat models"/"Image models" sections since 2026-08-08 (docs/21-image-engines.md). An "Add a model"
form appends a new `ai_models` row for any provider — this is the concrete "new model = INSERT, zero
deploy" moment: add a row here, it's live on the next chat request, no redeploy.

## Picker UI (2026-08-08)

Provider/tier/model `<select>`s (one choice per line) were replaced with two shared components in
`src/components/ui/`: `CardRadioGroup` (always-visible grid of cards, for small fixed sets — tiers,
icons, fonts) and `GridSelect` (a dropdown whose open panel is a grid, for longer/dynamic sets —
providers, models). `GridSelect` is a plain controlled component (no new dependency; this codebase
has no Radix/Headless UI) — closed state is a button, open state is an outside-click/Escape-closing
panel. Both live in `src/components/ui/` for reuse (also used by the frontpage section editor's icon
picker and the branding font pickers). `persona-form.tsx`'s advanced-mode provider/model pickers
only ever list `CHAT_PROVIDER_IDS`/`modality: 'text'` entries — an image engine can never be
assigned to a persona's chat model. `CHAT_PROVIDER_IDS`/`isChatProvider`/`ProviderId` live in the
new `src/lib/ai/provider-ids.ts` (no `@/db` import) specifically so client components can import
them without pulling this file's `'server-only'`-guarded database client into the browser bundle —
`registry.ts` re-exports everything from there for every existing server-side consumer.

## Verifying it

```sql
select key, label, default_model from ai_providers order by sort;
select p.key, m.model_id, m.tier, m.credits_per_1k, m.status
  from ai_models m join ai_providers p on p.id = m.provider_id order by p.sort, m.sort;
```
Confirmed against production: seed reproduced the exact pre-migration model list; `/personas/[slug]`
(public persona page, reads `getProviderRegistry()`), `/admin/personas` (list + form, reads registry
+ passes to the client form), `/admin/settings?group=ai` (reads registry + passes to
`AiSettingsForm`), and `/admin/ai-models` all build and respond correctly post-restart with no new
runtime errors.

## What's next

Phase 4 (persona versioning) is next — `personaVersions.aiModelId` becomes a real FK into `ai_models`,
which is why the model registry had to land first.
