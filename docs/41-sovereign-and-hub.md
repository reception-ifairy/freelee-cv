# The Sovereign design and the assistant hub

Two supplied packages, unpacked and adopted:

| Package | What was taken |
|---|---|
| `sovereignai-marketplace.zip` | The frontpage design language |
| `botverse-ai-marketplace.zip` | The chat hub and its lead-capture tools |

Both were adopted **through the systems already here** — the theme composer, the block builder and
the site assistant — rather than as a second design pasted alongside the first. That is what keeps
the look switchable and keeps persona, credit, moderation and rate-limit plumbing working.

## Sovereign — a monochrome editorial look

No colour at all. Authority comes from scale and restraint: a very large, very light headline,
hairline rules, micro labels at 10px with half an em of tracking, and a ghost numeral behind it all.

Delivered as two switchable things, not a rewrite:

- **A `Sovereign` palette preset** — near-white brand, true-black surface. One click in Branding,
  and one click back to indigo.
- **An `editorial` hero variant**, chosen per block in the builder: ghost `01`, eyebrow, the large
  light headline with a fading underlight rule, hairline bento pillars, live pulse and inline stats.

### Two deliberate departures from the original

- **It hardcodes white on black.** Everything here is a theme token, so the hero renders under any
  palette; it simply looks its best under Sovereign.
- **It animates with `motion`.** This hero is a **server component** with CSS-only reveals, so it
  costs no JavaScript. A hero is the first thing a visitor waits for — 40KB of animation library to
  fade text in is a poor trade.

### The bug a light brand exposed

Primary buttons were hardcoded `text-white`. That silently assumes a dark brand, which had always
been true — so nobody noticed. Pick Sovereign's near-white or Dark Luxury's champagne and the label
disappears into the button.

Fixed properly rather than per-component: `readableOn()` picks black or white by contrast, and the
result is emitted as `--color-on-brand`. Swapped through **60 files**. Verified live — under
Sovereign, `--color-on-brand` resolves to `#000000` and the buttons read correctly.

## The assistant hub — quick actions that capture leads

BotVerse's hub is a chat panel with a grid of small tools: claim a trial, request a callback,
subscribe, ask about pricing. The idea worth taking is the timing — **the moment somebody is
interested is the moment to ask**, not a contact page three clicks later.

Ported onto the existing assistant bubble as `AssistantTools`, switched on by
`site_assistant_tools` in Settings → Site assistant. The tools appear **before** the conversation
starts as well as during it: someone who only wants a callback should not have to chat first.

Only one form opens at a time — a 380px panel showing five forms at once is a wall, not an offer.

### Leads are stored properly

The original keeps leads in a module-level array that empties on restart. A lead is a person waiting
for a reply; losing one is worse than never offering the button. So: a real `leads` table
(`drizzle/0030_leads.sql`), and an admin screen at `/admin/leads` using the same grid/`⋯` pattern as
every other list.

The admin screen leads with **"1 person is waiting for a reply"** and puts *Email…* / *Call…* at the
top of the `⋯` menu — the reply route before the admin housekeeping.

`captureLeadAction` is **public and unauthenticated**, so it gets the same treatment as the
assistant itself:

- the tool is validated against `LEAD_TOOLS` rather than trusted
- only the fields that tool declares are stored, so a crafted payload cannot add its own
- rate limited to 6 an hour per visitor — an open endpoint that writes rows a human must action is
  a spam target

`chat_id` and `persona_id` null out with the conversation; the lead survives, because it is a person
rather than a chat artefact.

## Verified

| Check | Result |
|---|---|
| Sovereign preset applied to the live site | ✅ mono across home, personas, pricing |
| `--color-on-brand` under Sovereign | ✅ `#000000`, buttons legible |
| Editorial hero renders | ✅ ghost numeral, eyebrow, underlight, pillars, pulse |
| Five quick actions render in the bubble | ✅ |
| Submitting "Request a callback" | ✅ row in `leads`: kind, name, phone, status `new` |
| Admin shows "1 person is waiting" | ✅ |
| `⋯` offers Call first, then status changes | ✅ |
| Mark as contacted | ✅ status changed |
| All five verification suites | ✅ 79 assertions |

## Not taken

- **`motion`** — the animation library both packages use. The CSS reveals already here do the same
  job for nothing.
- **BotVerse's full-screen chat workspace.** `/chat/[id]` already is one, and a second full-screen
  chat would be two things to keep in step.
- **Sovereign's fictional content** — market sizes, compliance codes, NHS/FCA copy. It is
  placeholder text for a different product.
