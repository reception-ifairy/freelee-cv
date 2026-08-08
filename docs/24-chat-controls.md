# Conversation Controls

Shipped 2026-08-08. Lets a user adjust *how* a persona replies for their conversation only,
without editing the persona. Also the first UI for `setChatModifiersAction`, which had existed and
worked server-side since Phase 1 with nothing calling it.

## What's offered

Six dials in a collapsible **"How should it reply?"** panel above the composer:

| Control | Source | Gated by |
|---|---|---|
| Tone | `prompt_modifiers` type `tone` | `capabilities.tone` |
| Writing style | `prompt_modifiers` type `writing` | `capabilities.writing` |
| Output format | `prompt_modifiers` type `output` | `capabilities.output` |
| Length | `prompt_modifiers` type `length` | `capabilities.output` — no flag of its own |
| Interaction style | `interaction_style` enum | always available |
| When it does not know | `approach_to_unknown` enum | always available |

The last two are always available deliberately. They change how *safe* and *useful* an answer is
rather than how it's dressed — someone using a medical persona should be able to say "never guess"
regardless of how the persona was authored. The three modifier groups are stylistic, so they stay
an admin's per-persona choice.

## Storage

`chats.interaction_style` / `chats.approach_to_unknown` (migration `0022_chat_controls.sql`) reuse
the same enums `persona_versions` already uses. **NULL means "inherit from the persona"**, which is
every existing row — so no backfill, and a reader can tell "never chosen" apart from "deliberately
set to the value the persona already had".

`buildSystemPrompt()` needed no signature change: it already reads these off a merged object, so
`src/app/api/chat/route.ts` merges the chat's override over the version's value at the call site.

## Bug found in verification

`setChatControlsAction` filtered submitted modifier ids with
`.map(Number).filter(Number.isFinite)`. An unset `<select>` submits `''`, `Number('')` is `0`, and
`Number.isFinite(0)` is `true` — so **every control the user left alone stored a bogus modifier id
`0`**. A chat with one real choice came back reporting four, and `[2, 0, 0, 0]` was written to the
database.

Caught by the UI test asserting the "N set" badge matched what was actually chosen — it said "6
set" for three choices. Now filters on the raw string before converting and requires a positive
integer (serial primary keys start at 1).

## Not built

`tone`/`writing`/`output` gate this panel, but `vision`, `images`, `embed` and `badwordFilter`
remain unwired — see docs/23-chat-layouts.md for why each is blocked.
