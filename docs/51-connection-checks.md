# Connection checks: Save → Test → Fetch

Every place in Settings that holds a key or talks to an outside service now works the same way:
**Save** the key, then **Test** appears; when the test passes, **Fetch** appears and pulls what that
service offers (models, voices, sender domains). Introduced in update #62 (2026-11-11).

## Why one flow

Before, an AI provider was set up across two screens that never referred to each other: the key was
typed in *Providers & keys*, while *Test connection* and *Fetch models* lived on *Models*, and Fetch
did not need a passing test — or even a saved key. Fetch then showed a checklist to tick and import.
Google, Tavily and ElevenLabs keys existed in the settings schema but had no input at all, Stability
had no setting, and nothing outside AI could be tested. The owner's rule: after saving, a Test
button; after a good test, a Fetch button that updates the models by itself.

## The contract

`src/components/admin/connection-card.tsx` renders one card per connection from a
`ConnectionView` built by `connectionView()` in `src/lib/connections/registry.ts`:

- **Test** is shown only when the connection is configured (a saved value, or the env file) **and**
  the inputs are unchanged. Editing a field hides Test and Fetch until Save, so a test always checks
  what is actually stored.
- **Fetch** is shown only after the latest stored test is `ok`, and `fetchConnectionAction` refuses
  on the server otherwise.
- **Saving clears the stored result.** A new key has not been tested.
- **The result is remembered** in `settings` under `conn_test:<id>` as `{ state, message, at }` —
  never the key, and anything key-shaped in a provider's error text is masked before storing.
- **Nothing runs on page load.** Each Test or Fetch is one click, rate-limited to 20 a minute.
- The browser never receives a secret: secret fields arrive as `saved: true|false`, env variables as
  name + present.

States: `ok` · `no-key` · `bad-key` · `no-credit` · `error`, shown with the tones the old
`HealthBanner` used (`src/components/admin/test-status.tsx`).

## The connections

| Card | Where | Test | Fetch |
|---|---|---|---|
| OpenAI, Anthropic, Google, OpenRouter | Providers & keys | 8-token completion with the provider's default model (`checkProviderHealth`) — fractions of a cent | Model sync (below) |
| Ollama | Providers & keys | Completion against the configured base URL (free, local) | Model sync |
| Stability AI | Providers & keys | `/v1/user/balance` (free) | Engine list |
| Tavily | Providers & keys → Tools | One search (one Tavily credit) | — |
| ElevenLabs | Providers & keys → Tools | Lists voices | Voices, with a picker that sets `elevenlabs_voice_id` (checked against the live list) |
| Resend | Email | `GET /domains` | Verified sender domains |
| Stripe | Billing (env only) | Counts products/prices — nothing charged | — |
| PayPal | Billing (env only) | OAuth client-credentials token | — |
| S3 bucket | Media storage (env only) | `HEAD` bucket with the real signer | — |
| Knowledge sources | Knowledge → External sources | Searches that one source with its label as the query (works on inactive sources) and shows the first results | (the results are the fetch) |

Stripe, PayPal and S3 stay in the server env file by decision: payment and storage secrets are not
stored in the database. Their cards are read-only and say which variables are set.

## Model sync: automatic, and conservative

`syncProviderModels()` (`src/lib/ai/sync-models.ts`) replaces tick-and-import:

- **New models are added as `preview`** with no tier and a placeholder price. Preview models are
  catalogued but never offered to customers — someone marks a model Stable on purpose, after setting
  its price.
- **Existing rows are never changed.**
- **Models the provider no longer lists are only counted** in the summary ("3 not in the provider's
  list"), not deprecated. Provider lists use dated ids where the catalogue often holds aliases
  (`claude-sonnet-4-5` vs `claude-sonnet-4-5-20250929`), so automatic deprecation could switch off
  a model live bots use. That decision stays with a person.
- Modality comes from the fetcher, now including `embedding`. Audio/realtime models are skipped,
  Google `-image` models filed as images, and OpenRouter models that cannot answer in text skipped.

The Models section shows preview models in a collapsed group so a long list does not bury the
stable ones, shows embedding models, and has the **embedding model picker** for
`library_embedding_model` that the Knowledgebase page always pointed to.

## Bugs fixed on the way

- The health check ignored the `ollama_base_url` setting and hard-coded OpenRouter's URL, so Test and
  Fetch could disagree about which server they talked to.
- `revalidatePath('/admin/ai-models')` pointed at a redirect, so the page did not refresh after an
  action.
- The defaults form crashed when OpenAI had no tiered models.
- Knowledge sources: Save gave no feedback, unticking *Active* failed validation and silently dropped
  the save, the clear-key boxes were never rendered, and Test searched active sources only.

## Verified (2026-11-11, live)

- OpenAI: Test → "Works — gpt-5.4-mini answered", Fetch → 56 new preview models (43 text, 11 image,
  2 embedding); the stable catalogue offered to customers unchanged at 7.
- Stripe and PayPal cards correctly report *Not set*: their env values are empty on this server, which
  is also why the site cannot take payments yet.
- No console errors; no horizontal scroll at 375 px on Providers & keys, Models and Billing.
- Not exercised against a real account (no keys here): Stability, Tavily, ElevenLabs, Resend, S3, and
  knowledge sources (none configured).

## Known gaps

- `embedPassages` reads the OpenAI key from settings only; a key present only in the env file is
  reported missing. Not an issue on this server.
- Stability's Fetch lists v1 engines, whose ids may not match the v2beta image endpoints — check
  before marking a fetched Stability model Stable.
