# Integration candidates

A ranked list of external APIs that would genuinely add to this project, written 2026-08-09.

**Ranked by how cleanly each lands in a seam that already exists**, not by how exciting it is. This
codebase has spent several phases building extension points — the AI provider registry, the
knowledge-source registry, capability flags, the media-store driver, the modifier system. An
integration that drops into one of those is a day's work. One that needs a new seam is a project.
That difference matters more than the feature list.

---

## Tier 1 — lands in a seam that already exists

### 1. ElevenLabs — voice (the strongest candidate)

**The gap it fixes is real.** `capabilities.voiceIn` / `voiceOut` are wired and working, but they
use *browser* APIs: `speechSynthesis` for output, which sounds robotic and differs per OS, and
`SpeechRecognition` for input, which **only exists in Chrome** — Firefox and Safari users see no
mic button at all. For the Learning and Supportive chat layouts, where read-aloud is a core
affordance rather than a nicety, that's the weakest part of the product.

- **TTS**: ~$0.10 per 1,000 characters (Multilingual v2), ~$0.05 (Flash/Turbo), reduced up to 55%
  in May 2026 ([pricing breakdown](https://developer.puter.com/tutorials/elevenlabs-api-pricing/),
  [plan comparison](https://www.jellypod.com/blog/elevenlabs-pricing))
- **STT (Scribe)** covers the voice-input half, and works in every browser because the recording is
  just an audio upload

**What it needs here:** the pieces are mostly built. `MediaStore` (new today) already stores and
serves arbitrary bytes; `messages.attachments` already carries `{url, mediaType}` per message. Two
real changes: widen `MessageAttachment` beyond `kind: 'upload' | 'generated'` to include `'audio'`,
and add a per-character cost alongside `credits_per_image` — the same shape, a different unit.
A per-persona voice ID would sit naturally on `persona_versions`.

**Caveat worth pricing in:** voice is billed per character of *output*, and personas are chatty.
Read-aloud on every reply would be a meaningful line item — make it a tap-to-play, not automatic.

### 2. Tavily (or Brave Search / Exa) — web grounding

**This may need no code at all.** `knowledge_sources` (docs/18) already POSTs
`{query, grant, k}` to a configurable `{baseUrl}{path}` with a Bearer key and reads results through
admin-configured dot-paths. Tavily's search API is very close to that shape. It's worth **trying it
as an admin entry first** — base URL, path, key, and four dot-paths — before writing a line of code.
If it works, personas gain live web citation for the cost of filling in a form.

That's exactly what the generic dot-path design was for, and it would be the first real proof the
abstraction earns its keep against an API it wasn't written for.

### 3. OpenAI Moderation — real input filtering, free

`src/lib/moderation/filter.ts` is a word list, and it says so plainly: it catches lazy abuse and
will not stop anyone determined. The honest upgrade is a real classifier.

**OpenAI's Moderation endpoint is free**, covers 13 categories across text *and* image, and does
not count against usage limits ([details](https://evolink.ai/blog/openai-moderation-api-pricing),
[comparison](https://aisecurityandsafety.org/en/compare/openai-moderation-api-vs-azure-ai-content-safety/)).

**Fit:** `checkInput()` already has the right signature and the right call site — before persisting,
before the provider. Swapping the body for an API call is contained. Keep the word list as a
fallback for when the API is unreachable; the current fail-open posture is correct.

**One thing to verify first:** the account here has an OpenAI key with no credit. The moderation
endpoint is documented as free, but whether it answers on an unfunded account is untested — check
before relying on it.

For brand-specific rules or severity levels, Azure AI Content Safety is the paid alternative
([overview](https://www.edenai.co/post/content-moderation-apis-text-image-and-video-compared)).

### 4. Cloudflare R2 — object storage

Only matters when a second instance appears, but the work is **already done**: today's `S3Store`
driver is S3-compatible and R2 is the natural target (no egress fees, which suits image-heavy
chat). Set four env vars and `MEDIA_STORE=s3`.

Still needs one real-bucket smoke test — the signing is verified against AWS's own vector, but no
request has ever reached a live bucket from here.

---

## Tier 2 — needs a small new seam

### 5. Resend or Postmark — transactional email

**There is no email in this app at all.** Nothing sends a password reset, a receipt, an invoice, or
a "your subscription renews" notice. For something taking real money that's a genuine gap, not a
nice-to-have — a customer who forgets their password currently has no way back in.

Needs a small `src/lib/email/` with a driver (same shape as the media store) and a handful of
templates. Resend is the simplest for a Next app; Postmark has better deliverability reputation for
receipts.

### 6. Sentry — error tracking

Several real bugs this month were found by hand: images 404ing until a restart, a modifier filter
storing bogus zeros, a regex that silently dropped every line of dialogue. All of those were caught
because someone was *looking*. Production errors on a live site aren't.

Cheap to add, immediately useful, and no architectural change.

### 7. Deepgram / AssemblyAI — speech-to-text alternative

Only if ElevenLabs Scribe (#1) proves weak on accents or long audio. Same seam, so switching later
is cheap — which is a reason *not* to over-think the first choice.

---

## Tier 3 — real projects, defer until something demands them

### 8. A vector database (Pinecone / Qdrant / pgvector)

`knowledge_sources` searches an API someone else operates. Letting a customer upload *their own*
documents and have a persona cite them is a different feature: ingestion, chunking, embeddings,
storage, retrieval. **pgvector deserves first look** — Postgres is already here, and one fewer
service is worth a lot.

### 9. Firecrawl — site-to-markdown ingestion

Pairs with #8. Pointless without it.

### 10. Replicate / fal.ai — more image models

`generate-image.ts` already dispatches per provider, so adding one is a contained branch. But
Gemini image generation works and is cheap, so this is only worth it for a specific model you
actually want (a particular FLUX or Ideogram checkpoint).

### 11. Stripe Connect — marketplace payouts

Schema-ready since Phase 9, deliberately unbuilt. Only worth it if external vendors become real.

---

## If you did three things

1. **ElevenLabs voice** — fixes the weakest working feature, and the Learning/Supportive layouts
   were designed for it
2. **Try Tavily as a knowledge source** — possibly zero code, and it tests whether the dot-path
   abstraction really generalises
3. **Email** — the only item on this list that's a *hole* rather than an *improvement*

Moderation is close behind, and free, so it's a cheap fourth.
