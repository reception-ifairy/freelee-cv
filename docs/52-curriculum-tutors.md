# Curriculum tutors: the character from freelee, the knowledge from the curriculum

Added 2026-11-12. A tutor on freelee is an ordinary persona whose **subject knowledge comes live
from curriculum.ifairy.co.uk** — the UK curriculum database on this same server — through two
tools, instead of from whatever the model remembers. The contract between the three systems
(curriculum, freelee, T1000) was agreed the same day; this page is the freelee side of it.

## The model

A curriculum tutor is three things:

| Part | Where it lives | What it decides |
|---|---|---|
| **Mindset persona** | The prompt, personality and blueprint, as for any persona | Who the tutor is, its voice, and *how* it teaches |
| **Scope** | `persona_versions.curriculum_scope` (migration 0040) | *Which* key stages and subjects it teaches, and optionally the learner's year |
| **Live knowledge** | `curriculum_search` and `curriculum_objectives`, built per request | *What* it teaches — passages, objectives and questions from the curriculum |

```json
{ "keyStages": ["KS2"], "subjects": ["mathematics"], "year": "Y4" }
```

`NULL` means "not a curriculum tutor" — every persona before this change. The column is on
`persona_versions`, not `personas`, because a scope changes what the bot does: it is drafted, pinned
and published with the prompt beside it (`11-persona-versioning.md`), and it is copied wherever a
version is copied — revert and duplicate (they spread every column), publish (in place), marketplace
install, `scripts/grant-grounding.ts` and the bundle importer (spread).

Three owner decisions shape everything below:

- **freelee is one consumer of the curriculum** — one `cur_…` key, one scope, set in T1000. Tutors
  narrow inside it; they never get keys of their own.
- **The curriculum logs what it served, never what was asked.** The people typing are children.
- **Tutors are mindset only.** The prompt should describe the character and the teaching, not
  carry subject content; the curriculum supplies that.

## The scope is enforced on both sides

**The curriculum's side is the outer wall.** freelee's key has a consumer scope (key stages,
subjects, item types, `commercialOnly`) and limits, edited in T1000's curriculum panel. Every `/v1`
request is intersected with it: a filter outside it is refused with 403, no filter means "within the
scope", and a limit reached is a 429.

**freelee's side is the classroom.** The key may see KS1–KS4; a KS2 tutor must still never hand a
seven-year-old a GCSE paper because the key happens to allow it. So, per request
(`curriculumTools()` in `src/lib/tools/registry.ts`):

1. **The input schema is built from the scope.** A tutor with several key stages or subjects gets an
   `enum` of exactly those; one with a single key stage or subject has no such parameter at all —
   it is fixed. The model is never told a value outside the scope exists.
2. **`execute` checks again**, because a schema is what the model is shown, not a guarantee. An
   out-of-scope value returns a sentence and makes no request.
3. **Results are filtered after they come back.** When the model picked nothing and the scope has
   several values, the request goes out without that filter (the curriculum's filters take one value
   each) and asks for 10 results; hits are kept only when their key-stage tag contains one of the
   tutor's stages (`"KS1|KS2"` matches KS2, `"cross"` applies everywhere, untagged is dropped) and
   their subject is one of its subjects. Objectives are filtered the same way.
4. **The prompt says it too** — the `## Teaching from the curriculum` section names the key stages
   with their years, the learner's year and the subjects.

The scope is re-read through `readCurriculumScope()` wherever it is used: jsonb has no shape, and a
hand-edited row must degrade to "not a tutor", never to a tool without limits.

## Why tools, not grounding

`48-knowledgebase.md` sets the rule: a persona gets automatic grounding **or** a tool, never both —
with `stepCountIs(5)` a tool result is resent on every later step, so both would pay twice for the
same passages. For a tutor the tool is clearly the right half:

- **Grounding searches on every turn, with the learner's last words.** In a lesson most turns are
  "ok", "yes", "I don't get it" or an answer to a sum. Each would be a search for nothing, a request
  against the key's daily limit, and passages billed as input tokens to the customer.
- **A tutor knows when it is about to teach something new.** The tool lets it ask then, with a
  query it wrote — the topic ("equivalent fractions"), not the child's sentence. That is cheaper,
  better retrieval, and it keeps a child's own words out of the request.
- **Objectives are a structured question** — this subject, this year, this strand — which a
  similarity search over the last message cannot express.

The two tools are **not** in `TOOL_CATALOG` and so not in the tool picker or the `tools` column:
the scope switches them on. A curriculum tool without a scope would have nothing to stay inside.
Nothing stops an admin from also ticking a knowledge source that points at the curriculum; the form
warns against it, and there is none on this server today.

## The tools

| Tool | Request | Input | Returns |
|---|---|---|---|
| `curriculum_search` | `POST /v1/rag/search {query, grant, itemType?, k, filters{key_stage, subject}}` | `query` (topic only), `itemType` (`chunk` default, `objective`, `question`), plus `keyStage` / `subject` only when the scope has several | Up to 4 hits: title, link, key stage, subject, text |
| `curriculum_objectives` | `GET /v1/objectives?key_stage&subject&year&strand&per=50` | `subject`, `year` (only years inside the scope), `strand`, plus `keyStage` when several | Objectives: code, statement, year, strand, statutory |

- **Text budget:** at most 900 characters per hit and 3,000 per call (`CURRICULUM_MAX_CHARS`),
  whole items dropped from the end. Like `GROUNDING_MAX_CHARS`, these numbers are prices.
- **Withheld text:** with `commercialOnly`, documents not cleared for commercial use come back with
  `text: null, withheld: "licence"`. The tool passes their title and link with a note telling the
  model to cite, not quote or summarise, text it never saw.
- **Citations:** every result carries its title and, where there is one, its link; the model is
  told to name the titles it uses. Objectives are cited by code.
- **The learner's year is the default** for objectives. Only maths and science are tagged to single
  years in the data (the rest to `Y3-Y4`, `Y5-Y6` or the whole key stage), so an empty answer for a
  year is retried once without it and the model is told it got the key stage instead.
- **Several key stages or subjects and nothing chosen:** search covers them all (filtered as
  above); objectives ask the model to name a subject or year rather than list everything.
- **Kinds of material follow the key.** `itemType` offers only the kinds the last Fetch says the key
  may see (all three before any Fetch), and `curriculum_objectives` is not offered at all when the
  key may not see objectives — either would be a 403 on every call. The prompt section names only
  the tools actually offered.
- **Only offered when the version has a scope _and_ a key is saved.** With a scope but no key the
  prompt section changes to say the curriculum cannot be checked right now — a model told to call a
  tool it does not have tends to pretend it did. (`web_search` is offered keyless and refuses; that
  costs a step and the tool's definition on every turn, which a tutor does not need to pay.)
- **Never throws.** Every failure is a short sentence for the model:

| Curriculum answer | The model is told |
|---|---|
| 403 "Outside this key's scope" | That is outside what this tutor may look up |
| 429 | Too many requests for now — tell the learner you cannot check, rather than guessing |
| 400 "possible personal information" (the old guard) | Search again with only the topic |
| no answer, timeout (8 s), 401, 5xx, not JSON | Curriculum is not available right now — say so rather than guessing |

The server log gets `[curriculum] <route> failed: HTTP <status> <the curriculum's error text>` —
never the request.

## Caching

`src/lib/curriculum/client.ts` keeps a small in-process cache for the tools: a `Map`, 10-minute
TTL, at most 500 entries, oldest evicted first, successful answers only. The key is the base URL, a
12-character SHA-256 fingerprint of the API key (a new key may have a different scope), the route,
and the query string or body.

Children ask the same things repeatedly, a tutor re-checks a topic over a lesson, and the AI SDK may
call the same tool twice in one turn; each of those would otherwise be a request against the daily
limit and an embedding on the curriculum's side. Ten minutes because curriculum content changes by
deploy, while a scope change made in T1000 should still show up within the lesson.

It is per process (PM2 runs one) and emptied by a restart. It holds request bodies — so the topic
queries — in memory only, never on disk or in the database. Test and Fetch bypass it.

## Costs

| | Who pays | Roughly |
|---|---|---|
| A search | the curriculum: one `text-embedding-3-small` embedding of the query | ~$0.0000003 |
| An objectives listing | nobody: a database read | free |
| Both | the key's `perMinute` / `perDay` limits | one request each (cache hits are free) |
| The tool result in the model | the customer's credits, as input tokens | ≤ 3,000 characters ≈ ≤ 750 tokens per call, resent on each later step of the turn |
| Being a tutor at all | the customer's credits | the two tool definitions and the prompt section, ~400 tokens, on every turn |
| Test | the curriculum | one health check and one 1-result search |
| Fetch | nobody | one `GET /v1/scope` |

A typical teaching turn is two steps — call, then answer — so the result is paid once. For scale,
`48-knowledgebase.md` measured ~780 tokens of grounding at 6 credits per reply against 2 credits
plain on Haiku 4.5; one curriculum call is the same order, but only on the turns that make one.
**Measured live (2026-11-12, Pan Kleks, KS1–KS2, default OpenAI model):** one answer to "explain
equivalent fractions, I'm in Year 4" made **four curriculum calls in one turn** (two objective
lists — the second the automatic retry without the year — and two searches), served 7 objectives and
5 passages, and cost **12,514 input / 348 output tokens = 232 credits**. The persona's own prompt is
only 1,314 characters; the cost is the tool results being resent on every later step of the turn.
The answer was right and cited `MA-Y3-020`. Before the imported tutors go live this needs tuning:
fewer calls per turn (one search or one objective list is usually enough), a smaller result budget,
and checking what the compiled system prompt adds.

## Privacy

- **The curriculum logs served items** — item ids, key stage, subject, status, latency, per
  consumer — and **never the query text**, kept 90 days (`served_log`, contract).
- **It redacts, never rejects:** names after "my name is", emails, UK postcodes and phone numbers
  are removed before embedding. The tool's description also tells the model to search with the
  topic only, never names or personal details.
- **freelee stores no tool traffic.** The assistant's reply is stored as for any chat; the tool
  calls and their results are not written to `messages` or anywhere else.
- **The connection card remembers only its verdict** (`conn_test:curriculum`), and `scrub()` now
  masks `cur_…` keys too.

## Setting it up

1. **In T1000's curriculum panel**, check freelee's client: enabled, grant `curriculum-rag`
   allowed, a scope (key stages, subjects, item types, `commercialOnly`) and limits.
2. **freelee → Settings → Providers & keys → Knowledge → Curriculum:** paste the `cur_…` key, leave
   the address and grant blank for the defaults, **Save → Test → Fetch scope**. Test calls
   `/v1/health` and searches "fractions" with the grant; Fetch stores `GET /v1/scope` as
   `curriculum_scope_cache` (key stages and subjects with counts, `commercialOnly`, limits).
3. **Persona → Prompt tab → Curriculum:** tick *Teaches from the curriculum*, the key stages and
   subjects (offered from the last Fetch), optionally a year, and save. The matching audience
   segment is added (KS1 → B2C-CYP-02, KS2 → 03, KS3 → 04, KS4 → 05, KS5 → 06), and an empty
   audience type becomes B2C — the Audience section of the prompt renders only with one.
4. Write the prompt as the character and its teaching style. Chat with it and check that it cites
   source titles and stays at its stage.

The key may also come from `CURRICULUM_API_KEY` in the env file; a saved one wins, as for every
connection.

## Files

| File | What |
|---|---|
| `drizzle/0040_persona_curriculum_scope.sql` | The column |
| `src/lib/curriculum/scope.ts` | Key stages, years, segments — plain and zod-free, so the persona form can use it |
| `src/lib/curriculum/stored.ts` | Parsers for the stored scope and the Fetch cache (`curriculum_scope_cache`) |
| `src/lib/curriculum/client.ts` | Config, the request, the cache, failures in words — `server-only` |
| `src/lib/tools/catalog.ts`, `registry.ts` | `CURRICULUM_TOOL_CATALOG`, `curriculumTools()` |
| `src/lib/connections/registry.ts` | The `curriculum` card: Test, Fetch, error wording |
| `src/lib/persona/form-schema.ts` | `parseCurriculumForm()` — shared with `scripts/verify-persona-form.ts` |
| `src/components/admin/persona-curriculum-section.tsx` | The Curriculum section of the Prompt tab |
| `src/lib/persona/prompt.ts` | `## Teaching from the curriculum` |
| `src/app/api/chat/route.ts` | Builds the tools and passes the scope to the prompt |

## Known gaps

- **Rooms and bot teams have no tools at all**, so a tutor there teaches without the curriculum —
  and without the prompt section, which is passed only by the one-to-one chat route.
- **Year matching is the curriculum's.** freelee sends `year=Y4` and falls back to the key stage
  when nothing comes back; whether `Y3-Y4` rows count as Year 4 is decided on the curriculum side.
- **Saving a new key does not clear the Fetch cache.** Fetch again after changing keys.
- **A teaching turn is expensive** — measured at 232 credits with four tool calls; see *Costs*. To
  tune before the tutors import.
- **A knowledge source pointing at the curriculum is warned against, not blocked.**

## Since #68: lessons with a child's plan

- **In a lesson** (a chat in child mode, docs/54) the tutor teaches from the child's learning plan,
  which is already in its prompt: the current unit and its objectives, built once from curriculum's
  plan pack.
- The two tools stay, as an exception: at most one look-up per turn, and two model steps.
- Outside lessons, nothing changes, except one thing for every chat: the last allowed step can no
  longer call a tool, so a turn always ends in an answer.
- Measurements: docs/53.

