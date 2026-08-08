# Image-Generation Engines

Shipped 2026-08-08. Adds the first image-capable providers/models to the AI model registry —
**catalog and admin configuration only**, confirmed scope: no end-user generation flow, no
credits-per-image, no job queue yet. That's deliberately deferred to a later pass.

## What this is (and isn't)

An admin can now enable an image-generation provider, save its API key, and fetch its real current
model/engine list from `/admin/ai-models` — the exact same "Fetch models" mechanism built for chat
providers (docs/10-ai-model-registry.md). Nothing in the app yet calls out to generate an actual
image; there's no chat-with-images UI, no credit deduction for a generation, no async job/polling
infrastructure. This page documents the catalog layer only.

## Providers wired up

**OpenAI** and **Stability AI** — chosen specifically because both expose a genuine, short,
enumerable live model list, matching the "always fetch, never hand-maintain a model list" rule this
whole feature is built around:

- **OpenAI** reuses the *existing* `openai` provider row (`ai_providers.supports` already included
  `'images'` since the registry's first migration) — same `openai_api_key`, no new settings field.
  Its `/v1/models` endpoint doesn't expose a capability flag, so `src/lib/ai/fetch-models.ts`
  classifies by id prefix (`gpt-image-`/`dall-e-` → image, `gpt-`/`o1-`/`o3-`/`o4-`/`chatgpt-` →
  text, everything else — embeddings/whisper/tts/moderation — excluded). A heuristic, not
  authoritative; stated here rather than silently assumed correct.
- **Stability AI** is a new `ai_providers` row (`STABILITY_API_KEY` env, no key configured on this
  deployment at ship time — its "Fetch models" button will show a clear "not configured" error
  until an admin adds one). Its list-models call is `GET https://api.stability.ai/v1/engines/list`
  — genuinely named "engines," matching the terminology used throughout this feature — filtered to
  `type: 'PICTURE'` entries.

**Deliberately not wired up this pass**: Replicate (its public API is its entire marketplace — not
a short enumerable list the way OpenAI's/Stability's are) and Google/Gemini (its image models come
back mixed into a general model-list endpoint with no clean modality signal). Both are realistic
future additions using the same `fetchProviderModels()` dispatch in `src/lib/ai/fetch-models.ts` —
noted here as a documented next step, not silently dropped.

## Schema

Purely additive (`drizzle/0019_image_engines.sql`):
- New enum `ai_model_modality` (`'text' | 'image'`); `ai_models.modality` column, `NOT NULL DEFAULT
  'text'` — every existing row stays `'text'`, zero behavior change for chat.
- One new `ai_providers` row for `stability`.
- **Zero image `ai_models` rows seeded on purpose** — per the same "don't hand-maintain a list that
  changes often" rule driving Part 2, Claude didn't pre-type current image model ids/pricing into a
  migration. The catalog starts empty; an admin populates it via "Fetch models."

## Registry changes

`src/lib/ai/registry.ts`: `ProviderId` gains `'stability'`; `ModelInfo` gains `modality: 'text' |
'image'`. `getModel()` (the chat-completion builder) explicitly throws for any non-chat provider
rather than silently building a broken handle against the wrong API shape — there's no execution
path to call it correctly yet. `isChatProvider()`/`CHAT_PROVIDER_IDS` (now in
`src/lib/ai/provider-ids.ts`, see docs/10-ai-model-registry.md) is the enforcement point everywhere
a persona's provider/model is chosen or saved — `persona-form.tsx`'s pickers only list chat
providers/text models, and `savePersonaAction`'s Zod schema rejects a non-chat `aiProvider`
server-side too (defence in depth, not just a UI-level filter).

## Admin UI

`/admin/ai-models` splits each provider's model list into "Chat models" / "Image models" by
`modality` — OpenAI shows both sections once populated, Stability only ever shows the image one (no
"default model" field either, since nothing consumes it yet for image generation). "Add a model"
gained a Modality select for manual adds. Otherwise identical to the chat-model flow: fetch, pick
from a checkbox grid, import as `status: 'preview'`, then price/tier via the existing per-model
inline edit row.

## What's next

The natural follow-ups, none built this pass: an actual generation call (likely `POST
/v1/images/generations` for OpenAI, Stability's `v2beta/stable-image/generate/*` family — both
synchronous single-call APIs, no polling needed at the provider level), a credits-per-image concept
alongside the existing credits-per-1k-tokens one, and a UI surface for triggering a generation.
Replicate/Google as additional providers once there's a concrete need to justify their less-clean
discovery story.
