# Capabilities tab

What buttons exist in the chat window, and what the window looks like.

## Chat layout

The biggest setting on this tab. It changes the whole interface — spacing, text size, which
controls appear, and for the story layouts, **the shape of the reply itself**.

Leave it on **Suggested** unless you have a reason. Suggested picks from the persona's category
and audience, and it gets it right for all 20 categories.

| Layout | What it looks like |
|---|---|
| **Standard** | The general-purpose window |
| **Learning** | Bigger text, large tappable prompts, read-aloud — for children |
| **Professional** | Dense, full-width, quotable — legal, finance, HR |
| **Studio** | Spacious reading column — writing and design |
| **Technical** | Highlighted code, minimal clutter |
| **Supportive** | Calm colours, gentle pacing, safety notes stand out — wellbeing |
| **Quick help** | Short, fast, tappable — support desks and bookings |
| **Narrative** | Narration, named dialogue and action beats styled separately |
| **Screenplay** | Proper script format — scene headings, character cues |
| **Gamebook** | Second-person story ending in numbered choices you tap |

The last three change what the AI is *told to produce*, not just how it's displayed. Pick
Gamebook and every reply ends with real choices the reader can click. Pick Screenplay and you get
scene headings and character cues. If you don't want that, don't pick them.

## The switches

| Switch | What it does | Tick it when |
|---|---|---|
| **Show starter suggestions** | Clickable prompts before the first message | Nearly always — an empty box loses people |
| **Show copy button** | Copy a reply to the clipboard | The output gets pasted somewhere — documents, code, emails |
| **Allow sharing conversations** | A share button in the header | The conversation isn't private by nature |
| **Voice input** | Dictate instead of typing | Children, accessibility, hands-busy use |
| **Voice output** | Read replies aloud | Same |
| **Offer tone selector** | Lets the user pick Friendly / Professional / Playful… | The right tone varies by user, not by persona |
| **Offer writing-style selector** | Explanatory / Narrative / Socratic / Technical | Same content suits different explanations |
| **Offer output-format selector** | Prose / Bullets / Steps / Table / Code | Output gets reused in different shapes |

### On the three selectors

Ticking any of tone, writing style or output format adds a **How should it reply?** panel above
the message box. Users can adjust those dials *for their conversation only* — your persona is
untouched.

That panel also always offers two more controls, which have no switch of their own:

- **Interaction style** — Formal, Casual, Enthusiastic, Concise, or Socratic
- **When it does not know** — say so, make an educated guess, or ask a question back

These are always available because they change how *safe* and *useful* an answer is, not just how
it's dressed. Someone using a medical persona should be able to say "never guess" regardless of
how the persona was authored.

## Not yet working

Two switches exist and currently do nothing: **Accept image uploads** and **Generate images**.
Both need machinery that isn't built yet. They're left visible rather than hidden so the intent is
recorded — but ticking them changes nothing today.

**Filter offensive input** likewise has no effect in code. Use guardrails on the
[Prompt tab](/admin/handbook/persona-prompt) instead; those genuinely shape behaviour.
