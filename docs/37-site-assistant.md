# The site assistant

A chat bubble on every public page, answering as one of your own personas.

## It **is** a persona

This is the whole design. A setting names a persona slug; that persona's model, tone, personality
traits, tools, guardrails, capabilities, chat layout, conversation controls, moderation and voice
are what the bubble uses. You build it at `/admin/personas/<id>` exactly like any other.

A separate customer-service chatbot would have had to re-earn all of that, and would have drifted
from the real thing within a release.

The bubble renders **`ChatWindow`** — the same component the chat page and the embed widget use — so
tools, voice, markdown, suggestions, moderation and the narrative layouts worked on day one. Only
the sizing differs, the trick `embed-chat.tsx` already used.

## Settings — Admin → Settings → Assistant

| Key | Purpose |
|---|---|
| `site_assistant_enabled` | Master switch |
| `site_assistant_persona` | Persona **slug** — the assistant's whole character |
| `site_assistant_guest_messages` | Free messages per visitor conversation (default 10) |
| `site_assistant_label` | Launcher text (default "Ask us anything") |

Nothing about behaviour lives here. With no slug set, `getSiteAssistant()` returns `null` and the
bubble does not exist — verified: none of "Ask us anything", "assistant" or "Start the conversation"
appears anywhere in the HTML.

It returns `null` rather than falling back to another persona when the slug is wrong, the persona is
inactive, or it has no published version. A misconfigured assistant should be **absent**, never a
broken bubble on every page.

## Where it appears

Mounted once in `src/app/(marketing)/layout.tsx`: the front page, personas, pricing, blog and every
CMS page. `/chat/*`, `/embed/*` and `/admin/*` sit outside that layout and get nothing — a support
bubble inside a chat would be absurd.

## The conversation is created on the first message

`startChatAction` ends in `redirect()`, which a bubble cannot use, so its body was extracted into
`createChatForPersona()` and reused by a new `startAssistantChatAction()` that returns an id.
Nothing about version pinning, welcome messages, counters or the guest token is duplicated.

Opening the panel creates nothing. A chat per idle click would fill the table with empty rows — the
same reasoning already written into the embed page: a GET that writes means every crawler mints a
conversation.

## Free, and why that needed care

Support is free for everyone. Charging a customer to ask about their own invoice is exactly the
wrong moment to meter.

Two edits in `src/app/api/chat/route.ts`, both **derived on the server** from the configured slug and
the chat's own `personaId`:

- guests get `site_assistant_guest_messages` instead of the 3 free persona messages
- `spendCredits` is skipped entirely for signed-in users

`isAssistantPersona()` deliberately takes **no client input**. A request-body flag would let anyone
talk to any paid persona for nothing. This was tested, not assumed — see below.

Token cost is still written to `messages.creditsCost`, so the real cost of running support stays
visible in admin even though nobody is billed.

## Rate limiting — new to this codebase

**There was no rate limiting anywhere before this.** A free, unauthenticated LLM on every public page
is an open invitation to burn the account's API quota.

`src/lib/rate-limit.ts` is a fixed-window limiter keyed by user id, then guest cookie, then caller
IP. Two limits: **10 new conversations/hour** and **20 messages per 5 minutes**.

In-memory, deliberately — one pm2 process makes a module-level Map accurate and free. It is **not**
correct across multiple instances: each would keep its own counters and the effective limit would
multiply. Written down here rather than discovered later, the same way `storage/uploads` was flagged
before it became object storage.

It is not marked `server-only`: it uses no server APIs, and the guard would only stop the test from
running. The thing to avoid is importing it into a *client* component, where the counter would live
per browser and silently enforce nothing.

## What was verified

Against the live site:

| Check | Result |
|---|---|
| Unconfigured → no markup at all | ✅ 0 of 3 probes |
| Appears on `/`, `/personas`, `/pricing`, `/blog` | ✅ |
| Absent from `/admin` | ✅ |
| Opening the panel creates no chat | ✅ lazy, as designed |
| Guest conversation, real streamed reply | ✅ |
| Exactly one chat row created | ✅ 7 → 8 |
| **Signed-in user charged nothing** | ✅ balance 99889 → 99889, **0** new ledger rows, **0** new transactions |
| Usage still recorded | ✅ `creditsCost` written |
| Guest allowance is its own | ✅ messages 4–10 succeeded where the persona limit is 3 |
| Message 11 refused | ✅ 402 "You have used your 10 free messages" |
| **Spoofing the free path** | ✅ **rejected** — see below |
| Rate limit | ✅ 429 with `Retry-After: 185` |
| Limiter logic | ✅ 6/6 — `scripts/verify-rate-limit.ts` |

### The spoof test

A signed-in user posted directly to `/api/chat` against a **paid** persona's chat, with
`isAssistant`, `assistant`, `siteAssistant`, `free`, `skipCredits` and `personaId: 614` all set in
the body. The request succeeded — and **still charged 25 credits** and wrote a transaction. Every
faked flag was ignored, because the server reads the chat's own `personaId`.

## A collision worth knowing about

The admin on-page editor studio and this launcher were both `fixed bottom-4 right-4` and fought for
the same corner for an admin. The studio moved to the **left**; the customer-facing bubble owns the
conventional corner.

## Still open

- No human handoff and no lead capture. Both are natural for a customer-service bot; neither was
  needed to ship this.
- No conversation transcript emailed to the visitor.
- The rate limiter is per-process (see above).
