# 58 — The B2C foundation

**Owner decision, 2026-11-17:** "start with the B2C design in every category as the foundation". The
goal behind it: interest ordinary people in AI and give every field more everyday use, including for
people on a low income. A "find me a bot" for them is the next step and builds on this one.

## Why it was needed

Measured on the live database the day this was built:

| | |
|---|---|
| Fields whose sectors are scored well suited to consumers (mean B2C suitability ≥ 60) | 15 of 20 |
| Fields that link any B2C audience group | 1 (Education and Training) |
| Live bots of audience type B2C | 37 of 87 |
| Live bots tagged with any B2C group | 0 |
| An audience group for low income, cost of living or the general public | none of 70 |

The research said consumers matter almost everywhere, and nothing connected them to a field or to a bot.

## What it adds

### Three everyday audience groups

A new family in `src/lib/persona/audience-segments.ts`, **Everyday life** (`B2C-EVD`). These groups
cut across age and family: a person on a tight budget or new to AI can be any age.

| Code | Name | Who |
|---|---|---|
| `B2C-EVD-01` | Households on a Tight Budget | low income, squeezed by the cost of living, Universal Credit |
| `B2C-EVD-02` | Everyday Adults | the public with a task to get done today: letters, forms, plans |
| `B2C-EVD-03` | First-time AI Users | have not used an assistant before, or tried once and gave up |

There are now 73 groups. Families are derived from the code, so the Audiences screen shows the new one
without any other change.

### `category_use_cases` (migration `0044`)

A field's everyday uses. One row is one concrete situation, written in the person's terms: "my energy
bill went up and I can't pay it", not "a finance assistant".

| Column | Meaning |
|---|---|
| `title`, `situation` | the use, and who needs it and when |
| `first_message` | what they would type first |
| `segment_codes` | the B2C groups it is for (jsonb; no FK, as with `category_audience_segments`) |
| `budget_friendly` | saves money or helps someone with little of it |
| `sector_id` | the field's sector it belongs to, if one fits |
| `persona_id` | the bot that serves it, once approved; null is a gap |

They are read through the brief (`categoryBrief().useCases`), the one assembler. The agent's
`briefForModel` lists each use with its id. `scan_category` reports a field with no foundation, uses
with no bot, no budget-friendly use and no B2C group as gaps.

### The agent designs it: proposal kind `b2c_design`

The category agent (docs/57, #95) has a new step 2 between scanning and planning. When the brief says
"no B2C foundation", or the owner asks, it proposes:

- `groups` — the B2C groups the field serves, each with its own note. It always weighs the three
  everyday groups next to the field's own.
- `useCases` — 3 to 6 everyday uses.

`checkB2cDesign` in `agent-proposals.ts` refuses a design that:

- names a group that is not B2C;
- has no uses, or more than 8;
- has no budget-friendly use;
- files a use under another field's sector;
- repeats a title already in the field.

Already-linked groups are dropped. Approving links the groups after the existing ones and appends the
uses (`decideProposalAction`); it creates no bot.

A bot proposal may then name the `useCaseId` it serves. On approval that use's `persona_id` is set,
but only for a use in the same field. The planning step weighs a use with no bot heavily.

In a regulated field, a use is the everyday part (understanding a letter, preparing questions), never
the regulated advice itself; the system prompt says so.

### On screen

- **AI agent tab:** "Everyday uses · B2C" heads the side panel. With no foundation it has a
  *Design the B2C foundation* button, which is also the first suggestion. A `b2c_design` proposal
  shows its groups, its uses (with the first message) and the notes.
- **Brief tab:** a card with the field's everyday uses, their groups and whether each has a bot.

Nothing is public yet.

## How it is checked

- `taxonomy:verify-agent` checks that the three groups exist and are B2C in their own family, and that
  a design is accepted with codes normalised and linked groups dropped. It checks each refusal above,
  `useCaseId` within the field only, the scan's B2C gaps, and that the prompt names the three groups.
- `blocks:verify` (`verify-taxonomy-brief`) checks that the model brief carries the use id, the budget
  flag, the first message and "no bot yet", and says "no B2C foundation" when there is none.
- A live round trip on 2026-11-17 inserted a use for Lifestyle and Wellness, read it back through
  `categoryBrief`, `briefForModel` and `scanCategory`, then deleted it.

## Not done yet

- No field has a foundation: each agent has to be asked, and each run costs Opus tokens on the owner's
  key.
- The public "find me a random bot" by use, budget or group: the next step. It needs live bots linked
  to uses (`persona_id`), and today there are none.
- Uses cannot be edited or deleted from the panel; only through the agent (append) or SQL.
