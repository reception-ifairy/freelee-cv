# 53 · Measuring tutors — Baseline Tutor and the bench

**Status:** live since update #66 (2026-11-12). "Before" (#66) and "after" (#70) runs below.

## Why

Curriculum tutors (`52-curriculum-tutors.md`) are about to change shape: one learning plan per
child, the child's developmental level in every prompt, and at most one curriculum look-up per
turn. A change like that is only worth making if it can be measured, and Pan Kleks, the first
curriculum tutor, is a poor ruler: a long character prompt, a world, a voice. When his turn cost
232 credits nobody could say how much of that was the architecture and how much was the
character.

So there are two pieces:

- **Baseline Tutor** — a plain teacher with no world, no voice and a ~150-word prompt in which every
  rule is one the bench can check. A number moves only when the architecture moves. Every character
  imported later is measured against it: the difference is what the character costs.
- **The bench** (`scripts/tutor-bench.ts`) — a fixed set of learner messages sent through the real
  chat route, with every reply checked by plain code. No AI judge, so a run costs only its turns.

## Baseline Tutor

Created and kept in line by `scripts/bench/baseline-tutor.ts` (dry run by default, `--apply`
writes). Slug `baseline-tutor`, owned by the admin team, **inactive and private** — never listed,
never offered to customers; the bench creates its chats directly.

| Setting | Value | Why |
|---|---|---|
| Model | tier `balanced` (gpt-5.5 today) | same as Pan Kleks, so the comparison is like with like |
| Temperature | 0.2 | repeatable answers |
| Max output tokens | 1200 | gpt-5.5 reasons before answering and the cap counts those tokens: at 350, three of nine replies in the first run were cut mid-sentence. Reply length is held by the prompt instead. |
| History | 6 messages | enough for a two-turn case |
| Curriculum scope | KS1–KS4; mathematics, english (+ reading, GPS), science | covers every case |

The prompt asks for exactly what is checked: one small step; a short explanation, one worked
example, then exactly one question; sentence length by age; never "easy"/"simple", never "wrong",
no comparisons with other children; a final `Objective: CODE` line when it checked the curriculum.

## The bench

```
npx tsx scripts/tutor-bench.ts --label=before            # dry run — lists the cases, calls nothing
npx tsx scripts/tutor-bench.ts --label=before --apply    # paid: one model call per turn
npx tsx --conditions=react-server scripts/tutor-bench.ts --label=after --lesson --apply
  --persona=<slug>  --only=<case,...>  --max-turns=10  --keep  --base=https://freelee.cv
```

- **Cases** — `scripts/bench/tutor-cases.json`: 8 invented learner messages, 9 turns, Y1 to Y11
  (Y4 fractions is the question Pan Kleks was measured on; Y2 includes a wrong answer). Change them
  only together with a new "before" run, or the numbers stop being comparable.
- **Path** — each case gets a fresh admin chat; turns go to `POST /api/chat` with a 15-minute admin
  session minted from `AUTH_SECRET` (never printed), exactly the request a browser sends. Test chats
  are deleted afterwards (`--keep` keeps them); billing rows stay, as for any chat.
- **Cost numbers** come from the assistant row the route itself writes (`messages`): what a
  customer would be billed. Steps and tool calls are counted from the response stream.
- **Norms** come from curriculum `GET /v1/levels`, the measurable `checks` of each developmental
  level (levels 0–4 from *Designing an Adaptive Educational Engine*, level 5 from the GCSE guides;
  English phrases). The temporary local copy used for the "before" run was removed in #70.
- **`--lesson`** measures the child-centred architecture (docs/54). Each case gets a temporary child
  profile under the admin account with the case's year and subject, and its plan is built from
  curriculum's plan pack (the same code path as a parent's save). The chat is that child's lesson.
  Profiles, plans and lessons are deleted afterwards. Run it with `npx tsx --conditions=react-server`.
- **Results** — `scripts/bench/results/<date>-<label>.json` (not in git: replies are kept for
  reading). The summary goes into this document by hand.

### Checks, per turn

| Check | Passes when |
|---|---|
| sentence length | average words per sentence ≤ the level's maximum, longest ≤ 1.75 × it |
| reply length | words ≤ the level's maximum reply |
| avoided phrases | none of the level's phrases (e.g. "wrong" at levels 0–2, "it's easy" from level 3) |
| one question, last | exactly one question, and it is the last sentence |
| objective code | an `Objective:` line whose code exists in the curriculum and fits the learner's year or key stage |

The `[SUGGESTIONS: …]` trailer the chat turns into buttons, and the `Objective:` line, are not part
of the text that is measured.

## Results

### 2026-11-12 · before (today's architecture: two curriculum tools, up to 5 model steps)

| Case | Input tokens | Output | Credits | Steps | Tool calls | Checks |
|---|---|---|---|---|---|---|
| Y1 phonics | 8,473 | 721 | 166 | 5 | 4 | 5/5 |
| Y2 addition | 2,956 | 386 | 61 | 2 | 1 | 4/5 |
| Y2 wrong answer | 3,316 | 318 | 66 | 2 | 1 | 5/5 |
| Y4 fractions | 3,063 | 353 | 62 | 2 | 1 | 5/5 |
| Y4 science | 3,036 | 299 | 61 | 2 | 1 | 5/5 |
| Y6 grammar | 11,023 | 974 | 216 | 5 | 4 | 4/5 |
| Y8 science | 9,299 | 723 | 181 | 5 | 4 | 5/5 |
| Y10 quadratics | 3,084 | 619 | 67 | 2 | 1 | 4/5 |
| Y11 essay | 5,849 | 776 | 120 | 3 | 2 | 5/5 |
| **Average** | **5,567** | **574** | **111** | **3.1** | **2.1** | **42/45** |

Average latency 14 s. Pan Kleks on the Y4 question, for reference: 232 credits, 4 tool calls.

**What it shows:**

- **Cost is the tool loop, not the answer.** Four of nine turns went into a search → objectives →
  search loop and cost 120–216 credits; the five turns with one look-up cost 61–67. Every extra step
  re-sends the whole prompt.
- **The loop can leave a child with nothing.** In the first run (output cap 350, file
  `2026-11-12-before-cap350.json`) two turns used all 5 steps on tool calls and the child got an
  empty reply — billed 163 and 201 credits.
- **The character costs too.** Baseline Tutor answers the Y4 question for 62 credits; Pan Kleks
  spent 232. Part of that is the longer prompt, part is a character prompt that invites more looking
  up.
- **Format rules mostly hold** (42/45): one reply too long in sentences for Y2, one missing question,
  one missing objective line after four look-ups.

Spend for the three runs (smoke, cap-350, before): 19 turns, about 113,000 tokens on gpt-5.5.

### 2026-11-12 · after (#70: lessons — the child's plan and level in the prompt, at most one look-up, two steps)

| Case | Input tokens | Output | Credits | Steps | Tool calls | Checks |
|---|---|---|---|---|---|---|
| Y1 phonics | 1,792 | 412 | 40 | 1 | 0 | 5/5 |
| Y2 addition | 1,778 | 565 | 43 | 1 | 0 | 5/5 |
| Y2 wrong answer | 1,888 | 469 | 43 | 1 | 0 | 5/5 |
| Y4 fractions | 3,803 | 539 | 79 | 2 | 1 | 5/5 |
| Y4 science | 3,665 | 728 | 80 | 2 | 1 | 5/5 |
| Y6 grammar | 3,651 | 760 | 80 | 2 | 1 | 4/5 |
| Y8 science | 3,936 | 613 | 82 | 2 | 1 | 5/5 |
| Y10 quadratics | 1,813 | 598 | 44 | 1 | 0 | 5/5 |
| Y11 essay | 1,779 | 516 | 42 | 1 | 0 | 5/5 |
| **Average** | **2,678** | **578** | **59** | **1.4** | **0.44** | **44/45** |

**Before → after**

| Per turn | Before | After | Change |
|---|---|---|---|
| Credits, average | 111 | 59 | −47% |
| Credits, worst turn | 216 | 82 | −62% |
| Input tokens | 5,567 | 2,678 | −52% |
| Tool calls | 2.1 | 0.44 | −79% |
| Model steps | 3.1 | 1.4 | −55% |
| Checks passed | 42/45 | 44/45 | |
| Empty or cut replies | 2 (cap-350 run) | 0 | |

**What it shows**
- Five of nine turns needed no look-up at all: the plan already held the objective.
- The four that looked once (Y4, Y6, Y8) cost about 80 credits, which is still under half of the
  old loops.
- No turn went over 100 credits; the targets were met.
- The one failed check (Y6) is a missing `Objective:` line.

**Fixture change between the runs.** Baseline Tutor's objective rule now reads "end every reply with
`Objective: CODE` — from your learning plan if you have one, otherwise check once". The old wording
tied the line to a look-up, and in a lesson a look-up is no longer needed.

**Spend for the after run:** 9 turns plus one aborted turn, about 31,000 gpt-5.5 tokens.

### Targets for "after" (set in #66; met in #70)

- at most one curriculum look-up per turn, usually none (the child's plan is already in the prompt);
- input ≤ 5,000 tokens per turn, credits ≤ 80 per turn on average, no turn over 100;
- no empty or cut replies; checks pass in ≥ 90% of turns.
