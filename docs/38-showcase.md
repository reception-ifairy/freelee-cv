# Showcase

Curated examples of what the assistants actually produce, shown on the front page (or any page)
through a block.

## Why its own table

`showcase_items` is not a view over `messages`. Once you promote a piece it is the **site's**
marketing asset:

- it must survive the conversation being deleted
- it must not change because a customer edited or removed theirs
- and — the important one — **nothing a customer generates is public unless someone chose it**

`message_id` records provenance and nulls out with the conversation (`ON DELETE SET NULL`); the
showcase entry survives.

## Two ways in — Admin → Showcase

**By hand.** Title, image (a URL or a `/uploads/…` path), caption, which persona made it, and
optionally the ask that produced it.

**Promoted from a real conversation.** A panel lists assistant replies carrying a generated image.
One click copies it in. The **server** re-reads the message and takes the image, persona and prompt
from it — the form supplies only an id and a title. A form that could pass its own URL and caption
would let one admin session write arbitrary content onto a public page.

Promoted items arrive with **`show_prompt` off**. A real customer's wording can carry details they
would not expect published, so it has to be read and switched on deliberately. The admin list shows
an amber **"Prompt shown"** badge whenever a prompt is live, so that state is visible at a glance
rather than something to discover on the site.

> There are currently **0** generated images in the database, so the promote panel is empty and says
> so. Manual entry is what works until a persona with image generation produces something.

The admin screen reuses `ResourceView` (grid/list + `⋯` menu with delete-confirm) and the standard
`InlineForm`, so it introduced no new patterns.

## The block

`showcase` — one catalog entry plus one renderer, the two-file change the builder promises. Fields:
heading, sub-heading, how many to show, and an optional persona filter. Uses `layout.columns`.

Each tile opens a **lightbox** with the full image, the ask (when shown) and a "Work with
<persona>" button — which is what turns a wall of pictures into a route into the product.

### It forced the registry to become `.tsx`

Every other block is a server component, so `registry` called them as plain functions. The showcase
gallery needs state for the lightbox, making it the **first client block** — and a client component
can only cross the boundary as an element. Calling it threw:

```
Error: Attempted to call ShowcaseGallery() from the server but ShowcaseGallery is on the client.
```

`src/lib/blocks/registry.ts` is now `registry.tsx` and renders that one block as JSX. Worth knowing
before adding the next interactive block.

## What was verified

| Check | Result |
|---|---|
| Admin page loads, promote panel explains it is empty | ✅ |
| Three pieces added through the form | ✅ |
| Block added to the front page from the builder | ✅ |
| All three tiles render for an anonymous visitor | ✅ Poster · Brand palette · Product shot |
| Lightbox opens with image, title and the ask | ✅ |
| Escape closes it | ✅ |
| Hiding an item removes it for visitors | ✅ 3 → 2 |
| Home page byte-identical after cleanup | ✅ same sha256 |

## Still open

- No upload button — the image field takes a URL or an existing `/uploads/…` path. The media store
  exists (`src/lib/media/`); wiring a picker is the obvious next step.
- No drag-and-drop ordering; items move with up/down in the `⋯` menu.
- Only images. A "best reply" text showcase would need a different tile.
