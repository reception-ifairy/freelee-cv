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

Files now live in `storage/uploads` (outside `public/`, gitignored) and are served by
`src/app/uploads/[name]/route.ts`, which reads from disk per request. The public URL is unchanged.
Filenames must match `<uuid>.<ext>`, which is what makes path traversal impossible — `..` and `/`
simply cannot match the pattern.

**Local disk is a deliberate limitation.** Right for one box behind pm2, which is this deployment;
wrong the moment there are two instances or an ephemeral filesystem. Swapping in object storage
means changing `src/lib/media/store.ts` and that route, and nothing else.

## One rough edge, knowingly left

A generated image triggers a **full page reload**. The action writes the messages server-side, but
the transcript is `useChat` state seeded once from a prop, and a server revalidate can't push into
it — without the reload the image would sit in the database unseen. Blunt, but generation is
already a deliberate multi-second action. The tidy fix is for the generator to hand the new
messages to `useChat` directly, which means lifting it inside `ChatWindow`.

## Verified

Real end-to-end, not just typecheck: a red PNG uploaded and the model correctly answered "Red"; "a
single blue square" generated, saved and rendered; both surviving a reload and served at 200 with
**no restart in between** (the thing the `public/` bug broke). Filter blocking confirmed in the
live chat and across 22 matching cases. Embed confirmed working inside a real cross-origin iframe,
404ing with the capability off, while the rest of the site kept `X-Frame-Options: DENY`.
