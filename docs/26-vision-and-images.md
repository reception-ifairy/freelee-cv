# Vision, image generation, embedding and input filtering

Shipped 2026-08-09. The four persona capability flags that had UI checkboxes and no implementation
behind them. After this, every one of the twelve flags does something.

## Input filtering (`badwordFilter`)

`src/lib/moderation/filter.ts`, checked in `api/chat/route.ts` **before** the message is persisted
or sent, so a blocked message costs nothing and never reaches a provider. Also applied to image
prompts.

**Be clear about what it is:** a word-list matcher, not a moderation service. It catches lazy abuse
— the kind that makes a children's tutor produce something a parent screenshots — and will not stop
a determined person. Anyone needing real moderation wants a provider moderation endpoint.

Normalisation collapses the usual evasions: case, accents, repeats (`fuuuck`), separators
(`f-u-c-k`, `f u c k`) and digit substitutions (`sh1t`, `@ss`). Matching then requires **word
boundaries**, which is what keeps "Scunthorpe", "classic", "shiitake" and "assessment" safe.

Three bugs the tests caught before this shipped:
- `!` and `|` were mapped to `i` as leetspeak, so `WANKER!` normalised to `wankeri` and matched
  nothing. Ordinary trailing punctuation beats leetspeak coverage; both were removed from the map.
- Repeats collapsed to *two* characters, so `fuuuuck` became `fuuck`. Collapsing to one fixes it.
- Spaced-out letters weren't rejoined at all.

The admin list (**Settings → AI → Blocked words**) *replaces* the built-in list rather than adding
to it — otherwise a site that wants to allow a default term has no way to remove it.

## Embedding (`embed`)

`/embed/[slug]` — chrome-less chat for `<iframe>`. 404s unless the persona has the capability, so
embedding is an opt-in per persona rather than true of everything by default.

`X-Frame-Options: DENY` still applies to the whole site; `/embed/*` is carved out with a negative
lookahead and uses `Content-Security-Policy: frame-ancestors *` instead. That's not stylistic:
`X-Frame-Options` has no "allow any origin" value (`ALLOW-FROM` is dead everywhere), and a later
rule wouldn't override an earlier `DENY` — both headers would be sent.

**Two states, not one.** The bare URL shows an intro with a start button; the chat only exists once
that's pressed. A GET that created a conversation would mean every crawler, prefetch and iframe
re-render minting one.

Worth recording, because it cost a confusing test run: `frame-ancestors *` **does not match a
`file://` parent** — the wildcard covers network schemes only. The first embed test framed a local
HTML file and was blocked; the same page served over HTTP framed fine. The code was right and the
test was wrong.

## Vision (`vision`)

An attach button in the composer, capped at 4 images of 5 MB in png/jpeg/webp/gif.

Images travel as `data:` URLs and are sent to the model **inline**. They cannot be sent as links:
the provider would have to fetch `localhost:3015`, which it obviously cannot reach. The server then
decodes them to disk and stores the path in `messages.attachments`, so a reload shows the picture
rather than a message referring to one nobody can see.

The capability is enforced **server-side twice**: file parts on an incoming message are dropped if
the persona lacks `vision`, and they're also stripped from the resent history — a persona without
vision must never receive an image, including one attached before the flag was turned off.

## Image generation (`images`)

`src/lib/ai/generate-image.ts` with a branch per provider — Google, OpenAI, Stability. Raw `fetch`
rather than an SDK, because the three disagree about auth position, request shape and where the
bytes come back; an abstraction over three incompatible calls would be longer than the calls.

Billed **per image** via a new `ai_models.credits_per_image` (default 40, expected to be tuned per
model) — `credits_per_1k` cannot express the cost of a picture. The balance is *checked* before
generation so nobody starts a slow call they can't pay for, but *charged* only once an image is on
disk: a provider error, a content refusal or an unsavable format costs the user nothing, and there
is no refund path to get wrong.

It's a server action rather than part of the streaming chat route, because it's one slow request
with no tokens to stream.

## The `public/` trap — worth knowing

Uploads first went to `public/uploads`, which is the obvious place and **wrong**: Next builds its
static-file manifest when the server starts, so a file written there afterwards returns **404 until
the process restarts**. Verified directly — an upload 404'd, a `pm2 restart` with no other change
made the same URL return 200. Every user upload would have been broken until someone restarted.

Files live outside `public/` and are served by `src/app/uploads/[name]/route.ts`, which reads
through the storage driver per request. Filenames must match `<uuid>.<ext>`, which is what makes
path traversal impossible — `..` and `/` simply cannot match the pattern.

## Storage is pluggable (2026-08-09)

`src/lib/media/` is now driver-based:

| File | Role |
|---|---|
| `types.ts` | The `MediaStore` contract — `put` and `get`, nothing more |
| `local-store.ts` | Local disk. The default. |
| `s3-store.ts` | Any S3-compatible bucket — AWS, Cloudflare R2, MinIO, B2 |
| `sigv4.ts` | Request signing, hand-rolled |
| `store.ts` | Driver selection + the data-URL helpers callers use |

`MEDIA_STORE=s3` plus `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT`
switches backend. Misconfiguring it **throws** rather than silently falling back to local disk:
on a multi-instance deployment that fallback produces images that work on one box and 404 on the
next, which is a miserable intermittent bug to chase.

**Why local disk is still the default and still correct**: this is one box behind pm2. The trigger
for switching is a *second instance* or an ephemeral filesystem — not disk size — because instance
A cannot serve a file instance B wrote.

SigV4 is hand-rolled rather than pulling in `@aws-sdk/client-s3`, which is tens of megabytes for
two HTTP calls. That puts the burden on the signing being right, so it's verified:

```bash
npm run media:verify
```

- `scripts/verify-sigv4.ts` checks the signature against **AWS's own published `get-vanilla` test
  vector**. This caught a real bug: `x-amz-content-sha256` was being signed unconditionally, which
  is correct for S3 and wrong for generic SigV4, so the vector didn't reproduce. The algorithm was
  right; the header set wasn't.
- `scripts/verify-s3-store.ts` round-trips a real object through a local mock endpoint and asserts
  path-style URL, content type, credential scope, signed-header list, byte-identical retrieval, and
  that an invalid object name is refused *without* a network call.

**Stated plainly**: none of this has touched a real bucket — there are no credentials here. Do one
smoke test before trusting it with anything that matters.

## The generation reload, fixed (2026-08-09)

Generating an image used to trigger `window.location.reload()`. The action wrote the messages
server-side, but the transcript is `useChat` state seeded once from a prop, and a server
revalidate can't push into it — without the reload the image sat in the database unseen.

`ImageGenerator` now lives **inside** `ChatWindow`, where `setMessages` is in scope.
`generateImageAction` returns the two messages it created, and they're appended in place.

Two details that matter:
- The append is guarded by the last created message id. `useActionState` keeps its previous result
  across re-renders, so without the guard any unrelated re-render would append the same pair again.
- `revalidatePath` is still called, so a *fresh* page load is correct too. The returned messages
  only fix the transcript that's already open.

Verified by tagging the live document with a sentinel before generating: the image appeared, and
the sentinel survived — proving the document was never replaced.

## Verified

Real end-to-end, not just typecheck: a red PNG uploaded and the model correctly answered "Red"; "a
single blue square" generated, saved and rendered; both surviving a reload and served at 200 with
**no restart in between** (the thing the `public/` bug broke). Filter blocking confirmed in the
live chat and across 22 matching cases. Embed confirmed working inside a real cross-origin iframe,
404ing with the capability off, while the rest of the site kept `X-Frame-Options: DENY`.
