# Knowledgebase: a private library the bots can read

Books, papers and notes on disk become passages a persona can quote, with the page number. The
library never leaves this server: files sit on the attached volume, text and vectors sit in the same
Postgres the app already uses, and the only thing that goes to an external API is the text being
embedded and, at query time, the question itself.

Two constraints shaped this more than any technical one.

**Nothing is embedded behind your back.** Scanning discovers files; processing is a button. A watcher
that embedded whatever appeared would be less code and a worse product — processing spends money and
sends text out of the building, so it is a decision, not an event.

**Embedding has to be legible to someone who has not done it before.** That is a UI requirement with
teeth: four pipeline stages named in plain language, a viewer showing **the actual passages** a book
was cut into, and a test-question box showing **exactly what a bot would be handed**. Those two
screens are what turn this from something you trust into something you can judge.

## It plugs into a socket that already existed

`buildSystemPrompt` has had a `## Grounding — cite these references when you use them` section since
Phase 5, `persona_versions` has carried a `grounding_sources` array, and `/api/chat` has had exactly
one retrieval hook. All of it pointed at `searchMany`, which POSTs to *remote* REST APIs.

So `searchLibrary` returns the **same `KnowledgeChunk` type**, and the prompt builder needed no
change at all. One dispatcher, `searchGrounding`, splits a persona's keys by a `lib:` prefix and
fans out to both. The persona form gained rows in a group it already had, and the route changed one
identifier.

**One field, not two.** A second `library_collections` column on `persona_versions` would have meant
a second validation branch, a second checkbox group, a second call site and merge logic between two
lists. A prefix costs one function.

## What was missing, and now is not

pgvector was not installed. There was no embedding anywhere in the codebase — `ai_model_modality`
was `['text','image']` and the model importer *deliberately discarded* embedding models, correctly,
since nothing could consume one. PDFs were never parsed into text: `extract.ts` hands them to the
model as a file attachment, and its header explains why. And the media store physically cannot hold
a PDF (`OBJECT_NAME_RE` allows five image extensions and `mp3`), so the library needed its own home.

## The spike found two bugs no synthetic test could

The plan opened with an experiment rather than code: render three PDFs, run poppler, read the output.

**`-layout` interleaves columns.** It is the flag everyone reaches for and it preserves *physical*
layout, so a two-column page comes out as `fragment of column 1 … gutter … fragment of column 2` on
one line — half-sentences from two unrelated columns, on every journal PDF there is. Poppler's
default mode does reading-order detection and emits column one, then column two. Confirmed by
diffing the two outputs, not by reading documentation.

**Poppler emits `U+2010 HYPHEN`, not ASCII `-`.** NFKC does not fold it. The de-hyphenation rule
would have matched *nothing at all* on a real PDF while passing every synthetic test — the worst
class of bug, since the only symptom is slightly worse retrieval forever.

The property tests then caught two more, both in code that looked right:

- **The running-head stripper deleted body text.** A line repeated at the edge of most pages in a
  window is furniture — unless it is long, in which case it is prose. Without a length cap, a book
  where many pages end on the same sentence loses that sentence everywhere. The reassembly property
  (`chunks concatenated == cleaned source`) is what surfaced it.
- **Back matter was split by page.** A bibliography does not politely begin on a fresh sheet; it
  starts halfway down the page the last chapter ends on. Splitting by page tagged the closing
  paragraphs of the book as references and quietly removed them from retrieval. The split is now at
  the heading line, and one page can yield both.

## Storage

| Table | What it holds |
|---|---|
| `library_documents` | One row per file. **`source_path` is the identity**, `sha256` is the change detector |
| `library_collections` | Shelves — the unit a persona is granted. Same shape as `knowledge_sources` |
| `library_collection_documents` | Membership |
| `library_chunks` | Passages, with page range, heading, kind, and a generated `tsvector` |
| `library_chunk_vectors` | `vector(1536)`, `STORAGE PLAIN` |

**Identity is the path, not the hash.** Making `sha256` unique would turn "the author sent a
corrected PDF" into a duplicate row with the old passages still live.

**Vectors live apart from their text.** Together the row would be text (~2 KB) + tsvector (~3 KB) +
vector (6,152 B) ≈ 12 KB — past the 8 KB page, so Postgres would attempt pglz compression on float32
data (near-incompressible: wasted CPU on every insert) and then TOAST it out of line, making every
scan pay a detoast. Split, the vector table is one tuple per page, and re-embedding with a different
model becomes a `TRUNCATE` rather than a migration.

**A folder is a shelf.** The first path segment names the collection, created on sight. Nobody is
going to tick 500 checkboxes, and every alternative — a rule engine, a filename convention, a
classifier — is more machinery than dragging a file into the right folder.

## Retrieval

Hybrid: exact cosine over the vectors, plus keyword over the `tsvector`, fused by reciprocal rank,
capped at two passages per document, then each hit widened to its neighbours and stitched.

**The trap in hybrid search** is `websearch_to_tsquery`, which ANDs every term. A conversational
question becomes a nine-term AND matching zero rows, fusion silently degenerates to pure vector, and
every test still passes. The keyword leg builds an OR of the question's own lexemes, **inside
Postgres** (`unnest(to_tsvector(...))` through `quote_literal`) rather than by concatenating strings
in JavaScript. The collection filter is applied to *both* legs — forgetting it on the keyword leg is
the quiet way a persona cites a book it was never granted.

**No ANN index, deliberately.** pgvector 0.6.0 — the newest packaged for Ubuntu 24.04, and there is
no PGDG repo here — applies a `WHERE` filter *after* the approximate scan, so a query restricted to
one shelf can return two rows or none. `hnsw.iterative_scan` fixes exactly that and arrived in 0.8.0.
Exact search has perfect recall, no build step, no `ef_search` to tune, and at this corpus size runs
in a few hundred milliseconds. Add the index when a measured p95 says to. (0.6.0 *does* have HNSW,
and indexes up to **2,000 dimensions** — 1536 fits, `text-embedding-3-large`'s 3072 never could.)

**A relevance floor, measured rather than guessed.** Vector search has no concept of "no match" and
always returns its top k, so a question the library cannot answer came back with a confidently
irrelevant passage. Against the first ingested corpus:

| | cosine similarity |
|---|---|
| on topic | 0.43 – 0.74 |
| related | 0.26 – 0.28 |
| off topic | 0.008 – 0.04 |
| nonsense | 0.04 – 0.15 |

The floor sits at **0.25**, in the gap. Worth re-measuring as the library grows — the test-question
box shows these scores, so that is a five-minute check.

## Processing

`ingestDocument()` is one function; the queue calls it and so does the CLI. Two copies of a pipeline
this long is how a CLI quietly stops matching production.

1. **Read** — poppler in default mode, pages split on the `\f` form feed so page numbers are real.
   `execFile`, never a shell string, always with a timeout.
2. **Refuse what cannot be read** — `pdffonts` reporting no embedded fonts means an image-only scan.
   Definitive, where "few characters per page" is a guess: a 400-page book with twenty scanned plates
   should be ingested, not refused. Status `needs_ocr` — a backlog, not a failure.
3. **Clean** — NFKC, hyphen repair, running heads, bibliography tagged as `backmatter`.
4. **Cut** — ~1,100 characters on paragraph boundaries, no overlap.
5. **Embed** — `embedMany` in batches of 96.
6. **Commit once** — delete old passages, insert new, mark ready, **in a single transaction**. A
   crash leaves the document exactly as it was, never live-but-empty.

**Knowledge is its own admin section**, not two entries under AI: what the bots know is a body of
work in its own right — books to file, shelves to curate, external sources to wire up — and it grows
independently of how personas are configured. Adding it exposed a latent bug in the sidebar, since
`/admin/knowledgebase/collections` prefix-matches both *Library* and *Shelves* and lit up two rows
at once. The highlight now takes the longest match, which is the rule the breadcrumb always used.

**Small passages, no overlap.** Overlap costs ~15% more embedding for text you already have and
fills results with near-duplicates that crowd out genuinely different material. Instead every
passage keeps its `position` and retrieval stitches neighbours at read time — precision when
searching, context when answering. It also makes the corpus a clean partition, which is what allows
the reassembly property test to exist.

**A sweeper, not one job per book.** The worker runs exactly one job at a time, so 500 queued books
would hold the queue for hours and every crew run would wait. One `library.ingest_sweep` processes
until a count or a clock says stop, then re-enqueues itself.

**One atomic claim** (`UPDATE … WHERE status IN ('pending','failed') RETURNING id`) means the queue
and the CLI can both run and neither can process the same book twice. Zero rows back is not an
error — someone else owns it, and the caller returns successfully, which is what at-least-once
delivery requires. A `processing` row whose claim has gone stale is reclaimable: unlike `jobs`, this
table has no heartbeat, so without that a killed process wedges a book forever.

**Hashing is streamed.** `readFileSync` on a 40 MB book blocks the event loop long enough for the
worker's heartbeat to stop, the job to be reclaimed as stale after 90 seconds, and the same book to
run twice, concurrently. The claim would catch it — but not blocking beats relying on a lock.

## What it costs

**Indexing is a rounding error. Asking is not.**

| | 500 books | 10,000 documents |
|---|---|---|
| Embedding at $0.02/1M | **~$1.60** | **~$12**, once |
| Postgres | ~2 GB | ~15 GB |

Recurring cost is the extra context on every grounded answer, which `costForTokens` bills at the
same rate as any other input token — and **it lands on the customer's credit balance**, not yours.

The first estimate here said "roughly double". Measured against real traffic on this site it was
**five times**, because the average message is short (411 tokens in, 87 out) so the retrieved text
dominates the bill rather than adding to it:

| on Haiku 4.5 | plain | grounded |
|---|---|---|
| first settings (5 passages, ~2,000 tokens) | 2 credits | **10 credits** |
| current settings (up to 3, ~780 tokens) | 2 credits | **6 credits** |

A Starter pack (5,000 credits, $9) is ~2,500 plain replies, ~500 at the first settings, ~830 now.
The retrieval budget was cut deliberately on that evidence: `searchLibrary`'s `maxChars`,
`TARGET_CHARS` in the chunker, and `GROUNDING_MAX_CHARS` in the prompt are three numbers that are
each a **price**, and every one of them says so where it is defined.

Neighbour expansion was the biggest single cost and is now off by default — it tripled the text for
a modest gain in continuity. It stays available for the panel's test box, where nobody is charged.

Ingest has no billing home: `usage_events.team_id` is `NOT NULL` and a platform-wide backfill has no
team. Tokens are recorded on `library_documents.ingest_tokens` and summed for the panel instead of
being forced into a table that does not fit them.

## Server settings this depends on

Applied 2026-08-22 with `ALTER SYSTEM` (so they live in `postgresql.auto.conf`, **outside this
repository** — which is the only reason they are written down here):

| | packaged | now | why |
|---|---|---|---|
| `shared_buffers` | 128 MB | **8 GB** | ~1 GB of vectors is scanned exactly on every search. At 128 MB none of it stays resident and each query reads from the volume |
| `effective_cache_size` | 4 GB | **20 GB** | tells the planner what the OS is really caching |
| `maintenance_work_mem` | 64 MB | **2 GB** | pgvector's README warns an HNSW build spills once the graph stops fitting, and its own example fires at 100,000 tuples — roughly a 500-book library |
| `work_mem` | 4 MB | **32 MB** | sorting and hashing over passages |
| `random_page_cost` | 4 | **1.1** | SSD, not spinning rust |
| `max_parallel_maintenance_workers` | 2 | **4** | 0.6.0's headline feature is parallel HNSW builds |

The restart cost about seven seconds and affects every database on the host, not only this one.
`ALTER SYSTEM RESET ALL` plus a restart puts it back.

## Known gaps

- **Grounding still lives in the system prompt**, which mutates it every turn and defeats provider
  prompt caching on the large stable persona prefix. Moving retrieved passages into a message after
  the cacheable prefix is probably the single largest saving available here.
- **No OCR**, so scans sit in `needs_ocr`. `ocrmypdf` and `tesseract` are free and apt-installable;
  500 scanned books is CPU-days, which is why it is not in v1.
- **No `search_library` tool** yet. AI SDK v7 supports per-tool context natively (`tool({ contextSchema })`
  plus `streamText({ toolsContext })`), so it is a small change — but a persona should have automatic
  grounding *or* the tool, never both: with `stopWhen: stepCountIs(5)` a tool result is resent on
  every subsequent step, so enabling both pays twice for the same passages.
- **Rooms and crews still have no retrieval at all**, as before this change.
- **Upload in the panel** is not built; files arrive through the folder. nginx caps this host at
  12 MB and Next's server actions at 10 MB, so it needs a streaming route with its own location
  block rather than a server action.
