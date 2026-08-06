# Knowledge Sources

Shipped 2026-08-06. Replaces `src/lib/knowledge/registry.ts`'s hardcoded `{ curriculum, universe }`
record — two read-only RAG APIs belonging to two other, separate projects on this same server
(`curriculum.ifairy.co.uk`, `universe.ifairy.co.uk`), wired directly into freelee's code with their
own env vars and their own bespoke response-parsing function each. Both removed. In their place: an
admin-manageable registry any team's personas can point at any REST/JSON search API through.

## The core idea, and its limit

The request side of "call an external search API" is genuinely just data — base URL, path, API
key — same as `ai_providers` (Phase 3). The **response** side can't be, in general: arbitrary APIs
return arbitrarily-shaped JSON, and the two sources this replaced each needed a real parsing
function (`curriculum`'s hits were flat, `universe`'s were nested under `chunk`). The fix here is a
**dot-path spec** — `resultsPath`/`titlePath`/`textPath`/`citationPath` (e.g. `"data.results"`,
`"chunk.text"`) — walked with a small, deliberately dumb resolver (`resolvePath()`,
`src/lib/knowledge/registry.ts`): no array indices, no wildcards, just nested-object-key traversal.
This covers the realistic common case — a results array, each hit a flat-or-lightly-nested object
— without a bespoke parser per source. **Stated honestly**: an API that's paginated, GraphQL,
needs multi-step auth, or shapes its hits any other way still needs real code. This is the "simple
case, zero deploy" 80%, the same trade-off the AI model registry makes for OpenAI-compatible
providers vs. one requiring its own driver branch.

## Schema (`knowledge_sources`, migration `0017`)

`key` (slug, what `personaVersions.groundingSources` stores), `label`, `baseUrl`, `path` (default
`/v1/search`), `apiKey` (stored directly, never encrypted at rest — same posture the `settings`
table's own `secret`-type fields already have, not a new precedent), `grant` (optional — kept from
the two original sources' request shape, not required), the four dot-path columns, `isActive`.

## Request/response contract

`POST {baseUrl}{path}` with body `{ query, grant, k }`, header `Authorization: Bearer {apiKey}`,
5-second timeout via `AbortController`. A non-200 response, a `resultsPath` that doesn't resolve to
an array, or any thrown error all degrade to zero chunks — **never blocks or breaks a chat turn**,
the same contract the original hardcoded registry had. A hit whose `textPath` doesn't resolve to a
non-empty string is silently dropped (verified directly — see below), not sent to the model as an
empty grounding chunk.

## `/admin/knowledge-sources`

Full CRUD, plus one thing the two original hardcoded sources never had: a **Test** button
(`testKnowledgeSourceAction`) that fires a real search through the exact code path a chat turn
uses (`searchMany()`), so an admin gets immediate feedback that the dot-paths are configured
correctly — no need to create a persona and start a chat to find out. Editing a source's API
key/grant leaves it unchanged if the field is submitted blank (same convention as the settings
form's `secret` fields) — a checkbox exists to actually clear one.

## What changed at the call sites

- `personaVersions.groundingSources` (the jsonb key array) is unchanged in shape — a persona still
  just lists which source keys to query. What changed is where the valid key list comes from.
- `src/components/admin/persona-form.tsx`'s hardcoded `GROUNDING_SOURCES` array is gone — the
  checkboxes now render from a `knowledgeSources` prop, fetched from the DB by the two calling
  pages (`admin/personas/new`, `admin/personas/[id]`) via `getActiveKnowledgeSources()`, the same
  "fetch in the page, pass as a prop" pattern already used for `providers` (the AI registry).
- `src/server/actions/admin.ts`'s `savePersonaAction` used to validate submitted grounding-source
  keys with a synchronous type-guard (`isKnowledgeSourceId`, checking against the hardcoded union).
  Sources are real data now, so that became a real DB read — done once, into a `Set`, before
  building the values object, since a synchronous `.filter()` callback can't `await` per item.
- `src/db/seed.ts` had four demo personas hardcoding `groundingSources: ['curriculum']` /
  `['universe']` — removed. Referencing a source key that doesn't exist wasn't going to break
  anything (`searchMany()` just finds no active match and returns nothing), but it was stale/
  confusing seed data pointing at sources that no longer exist by default.

## Verifying it

Migration `0017_knowledge_sources.sql` — one new table, nothing existing touched.
`npm run typecheck`/`npm run build` clean; `npm run modules:verify` — 10 modules registered, all
dependencies resolve.

The generic fetch/dot-path pipeline was verified against a **real second HTTP server**, not a
mocked `fetch` — a genuine local server (Node's own `http` module) shaped exactly like the old
`universe` source's nested `{ chunk: { text, title, ref } }` response, with a real `knowledge_sources`
row pointed at it: a real HTTP POST correctly extracted nested-path title/text/citation, correctly
dropped a hit with empty `text`, correctly sent the `{query, grant, k}` body shape, and a wrong
`Authorization` header produced a real non-200 response that would correctly degrade to zero
chunks rather than throwing. All test data cleaned up afterward, zero residue.

## What's next

Nothing planned — this is complete infrastructure, not a phased rollout like translations or the
marketplace. An admin can add a real knowledge source today from `/admin/knowledge-sources` for any
REST/JSON search API that fits the contract above.
