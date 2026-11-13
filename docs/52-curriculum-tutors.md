# Curriculum tutors: the character from freelee, the knowledge from the curriculum

**Status:** the standard way every tutor for children works on freelee. Built 2026-11-12 in updates
#65–#70, together with curriculum.ifairy.co.uk PRs #29–#31 and T1000 #118–#120. This page is the
freelee side and the reference for anyone adding tutors. It covers how freelee and the curriculum
are connected, what goes where, what a lesson turn does, and what it costs.

## The whole system on one page

```
curriculum.ifairy.co.uk  — WHAT to teach, and HOW to talk at each age      (no data about any child)
  objectives (DfE, statutory) · units (topics in order) · levels 0–5 · GCSE pathways · passages · SATs questions
        ▲  Bearer cur_… key "freelee" — one consumer, one scope, limits; logs item ids served, never the request
        │
freelee.cv               — WHO is learning                                 (encrypted, docs/54)
  parent account → child profile → ONE learning plan per child (from POST /v1/plan-pack, built once)
  lesson = chat with child_profile_id: tutor prompt + learner section + plan slice; ≤ 1 look-up per turn
        ▲
T1000                    — the owner's view                                (never data about a child)
  curriculum consumer: scope, limits, usage, served items · Treści: units review, plan-pack preview · Poczta
```

**Owner decisions (2026-11-12)**

| Decision | What it means here |
|---|---|
| freelee is **one consumer** of the curriculum | One `cur_…` key, one scope, set in T1000. Tutors narrow inside it and never get keys of their own. |
| The curriculum **logs what it served, never what was asked** | The people typing are children. |
| **Tutors are characters, not subject experts** | The prompt carries voice, world and manner. Subject knowledge comes from the curriculum; how to talk at each age comes from the developmental levels. |
| **The plan belongs to the child, not the tutor** | Children change topics and tutors; the plan is shared by every tutor they talk to. |
| **Adults only** | A child is a profile under a parent's account, with encrypted data, field notes, consents, parent oversight and retention (docs/54). |
| **AI-assisted units are used now**, flagged `reviewed: false` | The owner reviews them in T1000. The DfE objectives linked to each unit carry the authoritative wording. |

## The model

A curriculum tutor is three things:

| Part | Where it lives | What it decides |
|---|---|---|
| **Character** | The prompt, personality and blueprint, as for any persona | Who the tutor is: voice, world, manner |
| **Scope** | `persona_versions.curriculum_scope` (migration 0040) | *Which* key stages and subjects it teaches (and, outside lessons, optionally a year) |
| **The curriculum** | The child's plan in the prompt (lessons) and two look-up tools | *What* it teaches, and *how to talk* at the child's age |

```json
{ "keyStages": ["KS2"], "subjects": ["mathematics"], "year": "Y4" }
```

`NULL` means "not a curriculum tutor". The column is on `persona_versions`, not `personas`, because a
scope changes what the bot does: it is drafted, pinned and published with the prompt beside it
(`11-persona-versioning.md`). It is copied wherever a version is copied: revert and duplicate (both
spread every column), publish (in place), marketplace install, `scripts/grant-grounding.ts` and the
bundle importer (spread).

**Who a tutor talks to:**
- **In a lesson** (child mode, `/learn`): a child with a profile and a plan. This is the normal case.
- **In an ordinary chat:** a signed-in adult, with the tools only.
- **Never a guest.** `POST /api/chat` answers 403 to a guest talking to a persona that has a scope.

## The curriculum API as freelee uses it

All calls go through `curriculumRequest()` in `src/lib/curriculum/client.ts`. That one function sets
the Bearer key, the timeout (8 s for tools, 15 s for the plan pack) and the error handling, and keeps
the small cache. Base URL, key and grant come from **Settings → Providers & keys → Knowledge →
Curriculum** (settings `curriculum_base_url`, `curriculum_api_key`, `curriculum_grant`).

| When | Request | What it returns | Who triggers it |
|---|---|---|---|
| Connection card **Test** | `GET /v1/health`, `POST /v1/rag/search {query:"fractions", k:1}` | stats; one hit | admin |
| Connection card **Fetch** | `GET /v1/scope` | what the key may see, with counts (stored as `curriculum_scope_cache`) | admin |
| A parent saves a profile, **Build/Refresh plan**, or the first lesson without a plan | `POST /v1/plan-pack {year, subjects, pathway?, includeSensitive?}` | units in order per subject with DfE objectives, the level profile, review intervals, the GCSE block from Y9, `curriculumVersion` | `ensurePlan()` in `src/lib/children/child-mode.ts` |
| A tutor looks something up (≤ 1 per lesson turn) | `POST /v1/rag/search` (`curriculum_search`), `GET /v1/objectives` (`curriculum_objectives`) | passages / objectives inside the scope | the model, through `curriculumTools()` |
| The measurement bench | `GET /v1/levels`, `GET /v1/objectives/:code` | level norms; one objective | `scripts/tutor-bench.ts` |

**What freelee sends** (and only this):
- the year;
- subject names;
- GCSE settings (when KS4 starts, tier, science route) and the PSHE opt-in;
- topic queries written by the model, such as "equivalent fractions", never the child's sentence.

`POST /v1/plan-pack` refuses any other field with 400 ("this API never takes personal data").

**The key's scope in curriculum** (set in T1000 → Centrum iFairy → Połączenia API → freelee):
- key stages KS1–KS4, all subjects;
- item types `chunk`, `objective`, `question`, `unit` and `profile` (the last two added 2026-11-12 for plans);
- `commercialOnly` on (non-commercial texts come back as title and link only), no `/v1/chat`;
- limits 60 per minute and 5,000 per day.

Every request is intersected with this scope: out of scope is a 403, over a limit is a 429.

## A lesson, step by step

1. **The parent saves a child profile** (`/dashboard/children`). The profile is sealed with the
   child's own key.
2. **freelee asks once for a plan pack** and builds the plan without AI (`src/lib/children/plan.ts`):
   - per subject, the year's units in course order;
   - a pointer to the current unit;
   - empty progress;
   - review intervals of 1, 3, 7 and 21 days.

   The plan is sealed in `child_plans`; `curriculum_version` stays plain so that "the programme
   changed" can be noticed without decrypting. Years 7–8 have no units yet: KS3 objectives stand in,
   and the plan's `gaps` says so.
3. **The parent starts child mode**; the child opens `/learn` and picks a tutor whose scope covers
   their key stage. `startLessonAction` creates a chat with `child_profile_id`.
4. **Each turn** (`src/app/api/chat/route.ts`):
   - **The prompt is assembled in a fixed order**, so the provider can cache the stable start:
     1. the tutor's own prompt (voice and world) and its compiled sections;
     2. *Teaching from the curriculum* in plan mode: teach from the plan; look up only what the plan
        does not cover, at most once;
     3. *Your learner*:
        - nickname, interests, focus, adaptations;
        - *how to talk in this year* from the **year profile** (since #73, curriculum PR #33):
          the year's limits as "about N words, never more than M", sentence length and count, one
          question or action, the optional "For the adult:" line, feedback length without praise
          words, no "I / we / us", new terms, Year 1 without negatives, the hint ladder, a full
          answer only after an attempt, and the year's never-do list (≈ 300–400 tokens). Plans
          without a year profile (Reception, or built before the update) keep the level profile
          (sentence and reply length, question types, praise, error handling, phrases never to
          use, session steps);
        - *the plan slice* for the tutor's subjects: the current unit, up to two of the year's
          learning areas for that subject (focus and "success looks like", the observable outcome
          a parent will see), up to 10 objectives with their state, the next unit, this term's
          emphasis and reviews due;
        - how to record progress.
   - **Tools:** `curriculum_search` and `curriculum_objectives`, built per request around the scope,
     with a **shared limit of one call per turn** (a second call is answered locally: "teach from
     the plan").
   - **Steps:** two model steps. On the last step tools are switched off (`toolChoice: 'none'`), so
     the turn always ends in an answer. This last-step rule applies to every chat on freelee.
   - **The reply** may end with `[PROGRESS: CODE learning|secure]`:
     - the server applies it to the plan; only codes in the plan count, and a subject moves on when
       its unit is secure;
     - the tag is removed before storing and hidden from display, even mid-stream.
   - **Storage:** the child's message and the reply are stored sealed (`enc:v1:`) with a generic
     title. `usage_events` records the steps and tool calls of the turn.
5. **The parent** reads full lessons and progress on the Children page and can export everything.
   The child sees "Your grown-up can read our chats." Year 1 lessons add "an adult-led session:
   please read each turn aloud and type what your child says"; Year 2 "works best read aloud"
   (`deliveryNotice()` in `src/lib/children/profile.ts`).
6. **Retention** (daily job): lessons are deleted 90 days after their last message; profiles unused
   for 12 months are deleted, with an email to the parent at 11 months.

## Year profiles: each school year on its own (#73)

The owner's iFairy v1.0 documents (2026-11-13) describe every year from 1 to 11 separately;
curriculum serves them as year profiles (`GET /v1/years/:year/profile`) and puts the compact form in
the plan pack (`yearProfile`, and per subject `categories`: the year's learning areas with their
function-named guide). A level spans two or three years — Years 1 and 2 shared a 70-word reply
limit — so where a year profile exists it replaces the level in the prompt.

| | Year 1 | Year 4 | Year 7 | Year 11 |
|---|---|---|---|---|
| Delivery in chat | adult-led: the adult reads aloud and types | child reads, adult nearby | learner leads within the adult's plan | learner leads |
| Words per turn (target / limit) | 12 / 20 | 40 / 50 | 70 / 80 | 120 / 130 |
| Words per sentence (target / limit) | 6 / 10 | 10 / 15 | 15 / 20 | 15 / 25 |
| Feedback (words) | 8 | 20 | 40 | 60 |

**The prompt aims below the target**: `min(target, 75% of the limit)` — from Year 4 the documents'
target is only 10 words under the limit, and a model rarely lands on an exact count.

**The validator** (`src/lib/children/turn-check.ts`, `npm run children:verify-turn-check`) applies
the documents' Part 3 rules to a reply: it splits off the "For the adult:" line, counts words
(symbols such as × or = on their own are not words), sentences and questions — including two
questions joined by "and" — and refuses first person (I, me, my, we, us, let's; allowed only in a
labelled language role-play), praise words, and negatives in Year 1 instructions. Today it measures
(`scripts/tutor-bench.ts`); checking replies before they are shown — regenerate once, then the
guide's line — is the next step, once the bench shows how often tutors overshoot.

**Function-named guides.** The DfE *Generative AI: product safety standards* (19 January 2026) ask
products to avoid names or characters that suggest a person and to avoid "I"-statements. The year
guides are named after what they do (Sound Lantern, Quantis Counting Gate, Lab Notebook); importing
them as tutors is an owner decision, as is any use of named characters with children.

## Making a tutor — the checklist for importing characters

1. **The prompt is the character, not the subject.** Voice, world, how it encourages, how it checks
   understanding.
   - Leave out curriculum content: the plan supplies it.
   - Leave out age rules: the level profile supplies them, so the same character works for a
     6-year-old and a 10-year-old.
   - Aim for a few thousand characters. The prompt is sent on every turn.
2. **Scope:** tick *Teaches from the curriculum*, the key stages and the subjects (Prompt tab →
   Curriculum). The matching audience segment is added (KS1 → B2C-CYP-02 … KS5 → 06).
3. **Measure it against Baseline Tutor:**
   `npx tsx --conditions=react-server scripts/tutor-bench.ts --persona=<slug> --lesson --label=<name> --apply`.
   The difference to the baseline is what the character costs.
4. **Safety fixes from the archive report** (`docs/tutors-import/RAPORT.md`) are mandatory:
   - no "secret mission" framing;
   - RSE relabelled and not taught;
   - UK crisis lines (Shout 85258, Childline 0800 1111);
   - one output format.

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

**Measured live, same 8 learner messages (Y1–Y11), gpt-5.5, Baseline Tutor (docs/53):**

| Per turn | Tools only, no plan (#66) | Lesson with the child's plan (#70) |
|---|---|---|
| Credits, average | 111 | **59** |
| Credits, worst turn | 216 | **82** |
| Input tokens | 5,567 | **2,678** |
| Tool calls | 2.1 | **0.44** (5 of 9 turns: none) |
| Model steps | 3.1 | **1.4** |
| Empty or cut replies | 2 (in a run with a 350-token cap) | **0** |

For reference, Pan Kleks (a long character prompt, tools only) spent 232 credits on the Y4
fractions question with four tool calls. A plan pack costs a lesson nothing: it is built once per
child, outside the chat. Its size on the real data is 8–21 KB, of which the tutor sees only the
current slice (≈ 600–900 tokens).

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
| `src/app/api/chat/route.ts` | Builds the tools (with the lesson limit), the learner section, sealing, progress, the last-step rule |
| `src/lib/children/plan.ts` | Plan from the plan pack, progress tags, spaced reviews, `learnerSection()` |
| `src/lib/children/child-mode.ts` | Child mode cookie, `childContext()`, `ensurePlan()` |
| `src/lib/children/tutors.ts` | Which tutors a child may have a lesson with |
| `scripts/tutor-bench.ts`, `scripts/bench/` | Baseline Tutor and the measurement (docs/53) |

## Known gaps

- **Rooms and bot teams have no tools and no learner section.** A tutor there talks like any persona.
  Lessons are one-to-one only.
- **Years 7–8 and Reception have no units yet.** KS3 objectives stand in, in document order. KS4
  objectives exist for 6 subjects; 42 DfE GCSE subject-content documents are in the catalogue
  waiting to be extracted.
- **Units are AI-assisted and unreviewed** until the owner ticks them in T1000 → Treści.
- **Year matching is the curriculum's** (`Y3-Y4` rows count for Year 4).
- **Saving a new key does not clear the Fetch cache.** Fetch again after changing keys.
- **A knowledge source pointing at the curriculum is warned against, not blocked.**
