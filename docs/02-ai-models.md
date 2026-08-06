# AI Models

**Superseded 2026-08-06** — the provider/model registry moved from a static const to
`ai_providers`/`ai_models` DB tables, admin-editable at `/admin/ai-models`. Full detail:
`10-ai-model-registry.md`. This page's remaining sections (resolution order, the 2026-08-03 bug fix,
settings, verification) are still accurate — only the registry's storage changed.

## Provider registry — `src/lib/ai/registry.ts`

Still the single source of truth every caller goes through, but the data now lives in the database,
not a module-level const. Adding a provider still needs a driver branch in `getModel()` (see
`10-ai-model-registry.md` for why); adding a **model** to an existing provider is now a plain INSERT
via `/admin/ai-models` — no code, no deploy.

```ts
export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'ollama'; // still fixed — drivers are code
export type ModelTier = 'fast' | 'balanced' | 'advanced';

getProviderRegistry() → Promise<Record<ProviderId, ProviderConfig>>   // DB-backed, cached per-request
```

`resolveTierModel(registry, providerId, tier)` — same role as before, now takes the already-fetched
registry as its first argument (see `10-ai-model-registry.md` for the full signature change and why
two client-side admin forms needed a `providers` prop instead of a direct import). Still resolved
**live** on every request, never cached on the persona row — a registry update (edit a model's
status/tier in `/admin/ai-models`) instantly fixes every persona on that tier, zero data migration.

## How a persona picks its model — three layers, in order

1. **Tier** (`personas.modelTier`) — the primary, recommended path. Admin picks Fast / Balanced /
   Advanced in the persona form; the concrete model is resolved from the registry at send time.
2. **Explicit model** (`personas.model` + `personas.aiProvider`) — an "advanced" escape hatch, a real
   `<select>` populated from the registry's curated model list (no free text, no invalid combos).
3. **Provider default** (`${providerId}_default_model` setting, or the registry's own default) — the
   fallback when a persona has neither.

## The bug that was fixed (2026-08-03)

`src/server/actions/chat.ts`'s `startChatAction` used to snapshot `persona.aiProvider`/`persona.model`
onto the `chats` row at creation time. `src/app/api/chat/route.ts` then preferred that snapshot over
the live persona value — so **editing a persona's model in `/admin` never affected any conversation
that already existed**, only brand-new chats. This is exactly the symptom "I changed the model but
it's still using the old one."

**Fix**: `startChatAction` no longer writes `aiProvider`/`model` at all — new chats get `NULL`/`NULL`.
`chats.aiProvider`/`chats.model` remain in the schema (nullable, no default) reserved for a possible
future "override this one thread's model" feature, but are expected to be null for virtually every
row post-fix. Resolution order in `route.ts` is now: per-thread override (rare) → live tier → live
explicit model → admin default → provider default.

**Data migration run alongside the code fix**: all 60 production personas (which had drifted onto
`openrouter`/`google/gemini-2.5-flash`, one even with a mismatched `aiProvider='openai'` +
Gemini-shaped model string) were reset to `aiProvider='openai'`, `modelTier='balanced'`, `model=NULL`.
Every existing `chats` row had its `aiProvider`/`model` cleared to `NULL` in the same transaction as
the code deploy, so already-open conversations picked up the fix immediately rather than staying
pinned until their next natural chat creation.

## Settings — provider keys & defaults

`/admin/settings?group=ai` (a dedicated `AiSettingsForm`, not the generic settings form): an
always-visible OpenAI card with the Fast/Balanced/Advanced tier picker (writes the resolved model id
into the `openai_default_model` setting), and a collapsed "Advanced providers" section for
Anthropic/OpenRouter/Ollama keys and default models. `${providerId}_api_key` and
`${providerId}_base_url` settings are read at chat time and passed into `getModel()`, so keys can be
rotated from the admin panel without a redeploy.

## Verifying the model actually used

`messages.model`/`messages.aiProvider` are populated in `route.ts`'s `onFinish` handler on every
assistant reply — this is the ground truth for "what model actually served this response," and needs
no extra tooling to check:

```sql
SELECT model, ai_provider FROM messages WHERE chat_id = '...' ORDER BY position DESC LIMIT 1;
```
