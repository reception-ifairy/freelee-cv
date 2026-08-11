# The bot converter

`/admin/personas/convert` — **admin only**. Drop in a document that describes a bot and get a draft
persona back: name, tagline, marketplace description, system prompt, opening line, starter
questions, knowledge domains, all ten personality traits and a full cognitive blueprint.

The point is migration. Moving an existing bot here otherwise means retyping a character brief into
a six-tab form, which is the sort of work that stops a migration happening at all.

## Where it is, and why only there

`requireAdmin()` in the action is the real gate — the `/admin` middleware and layout are defence in
depth, not the boundary. It matters more here than on most admin screens, because this action
**accepts an arbitrary file upload and spends real API credit on every call**. An unauthenticated
version would be both a parser target and a way to run up a bill.

It is also rate limited (20/hour, keyed by admin) despite being admin-only. One conversion is a
large prompt against the platform's best model; a stuck retry loop in a browser tab would be an
expensive afternoon.

## Reading the document

| Format | How |
|---|---|
| `.txt` `.md` `.json` `.csv` | Read directly |
| `.docx` `.xlsx` | Unzipped and parsed here — `src/lib/documents/extract.ts` |
| `.pdf` | **Not parsed.** Handed to the model as a file attachment |

**No dependencies.** Office files are ZIP archives of XML and Node already ships the hard part
(`inflateRawSync`), so the whole reader is about 120 lines. A parsing library would mean auditing
and updating it forever for two formats a handful of admins use a handful of times.

PDFs are the deliberate exception. Doing them properly means font encodings, CMaps and
content-stream operators — that genuinely *is* a library's job. So a PDF is passed straight to the
model, which reads it natively and far better than a naive text scrape would.

Two details worth keeping:

- Workbooks are flattened to **tab-separated rows**, not a dump of the shared-string table. A legacy
  bot config sheet is nearly always a key/value grid, and `tone → warm and direct` tells the model
  much more than those words loose.
- The ZIP **central directory** is read rather than scanning for local file headers. An entry
  written with a streaming data descriptor carries zeroes for its sizes in the local header; the
  real values only exist in the directory.

Caps: 8 MB per file, 120,000 characters to the model. A 400-page PDF would cost more to convert than
the persona is worth, and the character brief is always near the front.

## One persona format, not two

The source design this was adapted from emitted its own snake_case blueprint plus a bag of loose
key/value "attributes". Importing that shape would have meant a second persona format to compile,
migrate and keep in step with the first.

So the extraction targets **what this app already stores**: the flat persona fields plus the
camelCase `PersonaBlueprint` that has been in `db/schema.ts` since the Personat.AI port. A converted
persona is indistinguishable from a hand-written one the moment it lands, and `compileBlueprintSection()`
picks it up with no changes.

## Two things it deliberately does not do

**It does not publish.** The persona is created `is_active = false`. A machine-extracted character
must be read by a human before it reaches the marketplace — publishing straight to the public
catalogue would make an unreviewed model output the product. The editor opens on the next screen
with the publish toggle right there.

**It does not guess categories.** Category drives pricing, the marketplace filter and the suggested
toolset. A wrong guess there is worse than none, and the editor asks for it immediately.

The reviewed JSON is also **re-validated on import**. It travels to the browser and back as a hidden
field, so by the time it returns it can be anything at all — and it ends up compiled into a system
prompt that speaks to customers.

## Verified

Live, against the real Gemini default, with a real `.docx` written by Python's `zipfile` (not by our
own writer — a reader and writer sharing one bug would agree with each other):

| Check | Result |
|---|---|
| Three-line `.docx` → full persona | ✅ |
| The document actually steered the result | ✅ "never pushy" → patience 95, humour 20 |
| A stated rule survived into the prompt | ✅ "never quote prices without checking" became a CRITICAL RULE |
| Polish paste → Polish persona | ✅ prompt, welcome and suggestions all in Polish; enums stayed English |
| Blueprint stored in our camelCase shape | ✅ `personalityAndNarrativeProfile`, `coreOperatingProtocolSummary` |
| Import creates the persona and opens the editor | ✅ id 769, version linked, 1190-char prompt, 4 suggestions |
| Created hidden | ✅ `is_active = f`, absent from `/personas` |
| Non-admin replaying the captured server action | ✅ `{}` — no draft, no work done |
| Non-admin opening the page | ✅ redirected to login |
| `npx tsx scripts/verify-document-extract.ts` | ✅ 24/24 |

## A bug this turned up

The imported Polish persona got the slug `recepcjonistka-bia-y-zab`. `slugify()` normalises with
NFKD and strips combining marks, which handles `ą`, `ę` and `é` correctly — but `ł` is not a base
letter plus a mark, it is one glyph with a stroke. NFKD leaves it whole, and the ASCII filter turned
it into a hyphen.

Not cosmetic on a site that also runs in Polish, and it affected every slug in the app — pages,
posts, knowledge sources — not just converted personas. Fixed with an explicit map for the letters
NFKD cannot decompose (`ł ø đ ħ ß æ œ þ ð`). Existing rows keep their slugs, because a slug is a URL.

    Biały Ząb        -> bialy-zab
    Żółw i Łódź      -> zolw-i-lodz
    Straße 5         -> strasse-5
    Søren Ærø        -> soren-aero
