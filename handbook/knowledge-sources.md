# Knowledge sources

**AI → Knowledge sources.** Letting a persona quote from your own documents instead of relying on
what the model happens to remember.

## What this is for

Out of the box, a persona knows what its model was trained on — broad, undated, and with no idea
about *your* business. A knowledge source points it at a search API you control, so it can look
things up and cite them.

Typical uses: your product documentation, your policies, a curriculum, a research archive.

## What you need

A search API that accepts a POST with a query and returns JSON containing an array of results.
That's the whole requirement. You'll need:

| Field | Meaning |
|---|---|
| **Label** | A friendly name. Personas select it by this. |
| **Base URL** | `https://docs.example.com` |
| **Path** | `/v1/search` |
| **API key** | Sent as `Authorization: Bearer …`. Optional. |
| **Grant** | An extra field some APIs expect. Optional. |

## The four dot-paths

These tell the system where to find things inside your API's response. If a result looks like:

```json
{ "data": { "results": [ { "title": "…", "chunk": { "text": "…" }, "sourceUrl": "…" } ] } }
```

then you'd set: results `data.results`, title `title`, text `chunk.text`, citation `sourceUrl`.

Nested keys use dots. Array indices and wildcards are **not** supported — this handles the ordinary
case, not every possible API shape.

## Test connection

Type a query and press Test. It runs the real search through the same code a live chat uses, so if
it works here it works in a conversation. Do this before attaching the source to a persona —
otherwise a wrong dot-path shows up as a persona that mysteriously never cites anything.

## Attaching to a persona

On the persona's **Personality tab**, tick the sources it may use. Only ticked sources are
searched, so a persona doesn't pay the latency cost of sources irrelevant to it.

## If a source is down

Nothing breaks. A source that's unreachable, slow or returning nonsense simply contributes nothing
to that reply, and the persona answers from its own knowledge. It will never error out a
conversation.
