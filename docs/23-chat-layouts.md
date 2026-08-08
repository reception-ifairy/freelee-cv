# Chat Layouts

Shipped 2026-08-08. The chat window is the human↔AI interface, and until now
there was exactly one of it — a KS2 pupil, a compliance officer, a novelist and
a room full of colleagues all got the same bubbles, the same composer, the same
everything. This adds **thirteen layouts driven by one engine**, plus narrative
layouts that change the *output* itself.

## Why not one UI per category

There are 20 live categories. Twenty bespoke component trees would be
unmaintainable, and most pairs of categories don't actually differ in what the
interface needs to do. The categories cluster into a much smaller set of real
interaction problems, so each layout is a **config** consumed by shared
components (`src/lib/chat/layouts.ts`), never its own component tree.

| Layout | Surface | For |
|---|---|---|
| `default` | both | General purpose — unchanged from before this feature |
| `learning` | solo | School-age learners: roomy text, large tappable prompts, read-aloud |
| `professional` | solo | Legal, finance, HR, engineering — dense, quotable, document-style |
| `studio` | solo | Writing, design, marketing — spacious reading column |
| `technical` | both | Dev work — syntax-highlighted code, minimal chrome |
| `supportive` | solo | Wellbeing and health — calm palette, prominent guardrail callouts |
| `quick_help` | both | Support desks, bookings, FAQs — fast, short, tappable |
| `roundtable` | group | Equal participants, speaker-labelled rows |
| `workshop` | group | Brainstorms — roomy rows, prominent prompts |
| `briefing` | group | Stand-ups — compact, status-oriented |
| `narrative` | both | Story prose: narration, named dialogue, action beats |
| `screenplay` | both | Scene headings, character cues, dialogue, parentheticals |
| `gamebook` | both | Second-person interactive fiction, ending in tappable numbered choices |

## Narrative layouts change the output, not just the frame

This is the part that isn't cosmetic. A narrative layout does two things that
only work together:

1. **Prompts for a structure** — `narrativePromptFragment()` is appended to the
   system prompt in `src/app/api/chat/route.ts`, telling the model exactly how
   to mark narration, dialogue, action and choices.
2. **Parses and styles it back** — `src/lib/chat/narrative.ts` turns that into
   typed blocks, and `src/components/chat/narrative-message.tsx` renders each
   kind distinctly: dialogue gets a speaker label, stage directions are italic
   and set off, screenplay cues indent like a script, and a gamebook's numbered
   choices become buttons that fill the composer.

Doing only one half would be pointless — prompting for a structure nothing
renders is invisible; rendering a structure nothing produces is dead code.

**The parser is fail-open by construction.** Anything it doesn't recognise
becomes a narration block and renders as ordinary prose, so a model that
ignores the format instruction still produces a clean, readable reply. That
matters because the format is a *request* to a language model, not a guarantee.

## How a layout is chosen

`persona_versions.chat_layout` wins if set. Otherwise
`suggestLayoutForPersona()` computes one from signals the UK taxonomy already
carries (docs/05-uk-taxonomy.md), in this precedence:

1. A `B2C-CYP-*` audience segment (a school key stage) → `learning`. The
   strongest signal there is: a Year 4 pupil needs that interface whatever the
   subject.
2. **Category mapping** — the reliable signal, and the common case.
3. Interaction mode (`NARRATOR` → narrative, `FAQ` → quick help) and
   `narrative_potential` — only for a persona whose category has no mapping.
4. `B2B`/`B2G` audience with no category at all → `professional`.

**Step 2 sits above step 3 deliberately, and that ordering is load-bearing.**
The first version had the taxonomy signals first, which tested catastrophically
against real data: Education → narrative, Legal → quick help, Health → quick
help. The cause was that `sectors.primary_interaction_modes` was being
aggregated up from every sector in a category, and a five-sector category
almost always contains *some* NARRATOR or FAQ sector — so those rules fired for
nearly all 20 categories and overrode the mapping that was correct. Caught by
testing the function against the live taxonomy, not by review.

The root cause is fixed too: `resolveLayoutForPersona()`
(`src/lib/chat/resolve-layout.ts`) no longer reads sector modes at all, because
a persona links to *categories*, not sectors — the signal is real per-sector
and meaningless once flattened. The rules stay in `suggestLayoutForPersona()`
for a future where personas link to sectors directly; there just isn't a
per-persona mode signal to feed them today.

Verified: **20/20 categories map to the intended layout**, plus the override
cases (a KS2 audience inside Legal still gets `learning`).

## Capability flags — finally wired

Twelve `PersonaCapabilities` checkboxes had existed in the admin form since
Phase 1 and **none of them were read anywhere** in the chat runtime. Now:

| Flag | Effect |
|---|---|
| `copy` | Per-message copy button (also gated by the layout — a copy button is noise on a learning surface) |
| `share` | The Share button in the chat header, previously rendered unconditionally |
| `suggestions` | Whether starter/follow-up chips appear at all |
| `voiceOut` | "Read aloud" via `speechSynthesis` |
| `voiceIn` | Mic dictation via `SpeechRecognition`, feature-detected after mount |

Still unwired, and honestly so: `vision`/`images` need multimodal request
handling and real image generation (docs/21-image-engines.md stopped at
catalog); `embed` has no route; `badwordFilter` is moderation, not layout;
`tone`/`writing`/`output` need a modifier selector — `setChatModifiersAction`
already exists and works, it has no UI yet.

## Group layouts

Applied to `/rooms/[id]`, chosen from a picker in the room sidebar. A room's
layout lives in `conversations.settings` — a jsonb bag already documented for
per-room overrides like `maxPersonasPerRoom` — so group layouts needed **no
schema change at all**. `setRoomLayoutAction` only accepts group-surface
layouts: a room rendered with a solo layout would drop the speaker labels that
make a multi-participant transcript readable.

## Files

- `src/lib/chat/layouts.ts` — the 13 configs, `suggestLayoutForPersona()`, narrative prompt fragments
- `src/lib/chat/narrative.ts` — the block parser (+ `choicesOf`)
- `src/lib/chat/resolve-layout.ts` — server-side resolution from taxonomy
- `src/components/chat/` — `chat-window.tsx` (now a thin shell), `message-bubble.tsx`,
  `composer.tsx`, `suggestion-chips.tsx`, `narrative-message.tsx`
- `drizzle/0021_chat_layouts.sql` — one nullable column, no backfill

## Verifying it

The parser has known-tricky cases; test it directly rather than by eye. Two
regressions it already caught:
- `**Mira:**` (colon *inside* the bold — what the prompt actually asks for) was
  parsed as narration because the regex only handled `**Mira**:`. Every line of
  dialogue silently rendered as prose.
- `**Important** note here` parsed as dialogue spoken by "Important" until the
  colon was made mandatory and the speaker capped at 48 characters.

End-to-end, seed a persona with `chat_layout='gamebook'` and an assistant
message in the format, then load the chat: narration, a speaker-labelled
dialogue block, an italic stage direction and three numbered choice buttons
should render, clicking a choice should fill the composer, and no raw `**` or
`1)` should appear in the visible text.
