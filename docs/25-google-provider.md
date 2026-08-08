# Google (Gemini) provider

Added 2026-08-08, when the OpenAI account ran out of credit and Google was the only provider with
any. It's a full provider, not a stopgap: driver, live model fetch, tiers, and it now backs the AI
translation pipeline.

## What it took

Providers are deliberately a **code change**, not just data (see docs/10-ai-model-registry.md) —
each one needs a driver. Google needed three things:

1. `@ai-sdk/google` and a `createGoogleGenerativeAI` branch in `getModel()`. Google's API is
   neither OpenAI-shaped nor Anthropic-shaped, which is exactly why that branch has to exist.
2. `'google'` added to `ProviderId` and `CHAT_PROVIDER_IDS`.
3. A `fetchGoogleModels()` in `src/lib/ai/fetch-models.ts`. Google is the odd one out twice over:
   the key goes in the **query string** rather than a header, and ids come back **prefixed**
   (`models/gemini-flash-latest`) and must be stripped or every later call 404s.

`ai_providers` gets one row (migration `0023_google_provider.sql`); no models are seeded, because
they come from the live Fetch button like every other provider.

## The gotcha worth knowing: listed ≠ usable

Google's list endpoint returned **42 models supporting `generateContent`**. Importing three of the
obvious ones and calling them produced:

```
404  This model models/gemini-2.5-flash is no longer available to new users.
404  This model models/gemini-2.0-flash is no longer available.
```

Probing directly, on this account only the **`-latest` aliases** actually answer:

| Model id | Listed | Callable |
|---|---|---|
| `gemini-2.5-flash`, `gemini-2.5-pro` | yes | **no — 404** |
| `gemini-2.0-flash`, `gemini-2.0-flash-lite` | yes | **no — 404** |
| `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-pro-latest` | yes | **yes** |

So Google advertises models a given account cannot call, and the difference only shows up on a real
request. **Fetch models tells you what exists, not what you're entitled to use.** After importing
any Google model, send it one real message before assigning it a tier — a tier switches every
persona on it at once, and a 404 there is a broken product, not a warning.

The tiers now point at the aliases: fast → `gemini-flash-lite-latest`, balanced →
`gemini-flash-latest`, advanced → `gemini-pro-latest`. Aliases have their own trade-off — the model
behind one can change without notice — but a model that answers beats a pinned one that 404s.

## Translation now runs on it

`/admin/translations` resolves its model from `ai_default_provider`, so setting that to `google`
was all the panel needed. Full run: **88/88 strings across 7 modules in 48 seconds**, every
`{placeholder}` preserved.

`scripts/translate-bank.ts` was hardcoded to OpenAI and `gpt-4o-mini`, so the CLI and the panel
would have silently used different AIs. It now resolves provider, key and model the same way the
panel does, and prints which it's using.

## Key handling

The key lives in `.env.local` (gitignored) and the `settings` table. Settings wins, so it can be
rotated with no deploy. It is in no tracked file.

Note the pre-push secret scan used through this project matches `sk-`, `sk_live_`, `whsec_`,
`AKIA` and PEM blocks — **not** Google's `AIza…` format. That pattern has been added; a Google key
would previously have passed the scan unnoticed.
