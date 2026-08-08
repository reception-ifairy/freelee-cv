# Create your first persona

We'll build a real one end to end: **a friendly maths tutor for primary-school children.** Every
step below is a real field you'll find in **Personas → New persona**.

## 1. Basics

| Field | What to put | Our example |
|---|---|---|
| Name | What people call it | `Numera` |
| Slug | The web address. Leave blank and it fills itself in | `numera` |
| Tagline | One line, shown on the card | `Maths, explained without the panic` |
| Expertise | The subject, in two or three words | `Primary maths` |
| Description | A short paragraph for the persona's own page | *"Numera helps children aged 5–11..."* |
| Accent colour | The colour of its avatar tile | A friendly blue |

Don't agonise here. All of it is editable later, and none of it changes how the persona actually
behaves — this is the shop window, not the engine.

## 2. Prompt — the important one

This is the persona. Spend your time here.

A prompt that works usually answers four questions: **who are you, who are you talking to, how do
you behave, and what do you never do.**

```
You are Numera, a maths tutor for children aged 5 to 11.

You are talking to a child, or to a parent helping one. Assume no prior knowledge
and never assume the question is silly.

Always work through a problem one step at a time, and check the child is following
before moving on. Use small everyday examples — sweets, football scores, pocket
money — not abstract symbols.

Never just give the final answer to homework. Guide them to it, even if asked
directly. If a child seems upset or frustrated, slow down and encourage them
before continuing with the maths.
```

Notice what that prompt does *not* say: it doesn't say "be helpful" or "be friendly". Those words
are too vague to change anything. "Never just give the final answer to homework" is specific
enough that you'd notice if it were disobeyed. That's the test of a good instruction.

**Welcome message** — the first thing shown before anyone types. *"Hello! I'm Numera. What are we
working on today?"*

**Starter suggestions** — up to four clickable prompts for people who don't know what to ask.
*"Help me with fractions"*, *"I don't understand long division"*.

## 3. Model

Leave it on the **Balanced** tier. Really.

The tiers — Fast, Balanced, Advanced — mean the exact model is resolved fresh on every message. So
when a provider renames or retires a model, your persona keeps working and you do nothing. If you
pin a specific model instead, you own that maintenance forever.

**Temperature** is the one setting worth thinking about: low is repeatable and predictable, high is
varied and creative. A tutor should be predictable — around 0.6. A brainstorming persona might sit
at 1.0.

## 4. Personality

Ten sliders. They nudge tone; they don't override your prompt. For Numera:

- **Patience: 95** — the whole job
- **Warmth: 85** — a nervous child needs it
- **Encouragement: 90**
- **Directness: 30** — deliberately low; we want guiding, not telling
- **Formality: 15** — talking to a seven-year-old

Set the three or four that matter and leave the rest in the middle. Turning every slider to 100
doesn't make a persona better, it makes it shapeless.

## 5. Capabilities

Tick what genuinely helps this persona:

- **Show starter suggestions** — yes
- **Voice output (read aloud)** — yes, a child may read slowly
- **Show copy button** — no, pointless here
- **Allow sharing conversations** — your call

Leave **Chat layout** on **Suggested**. Because we'll file this under Education, it will pick the
**Learning** layout by itself: bigger text, large tappable prompts, a read-aloud button. That's
the right interface for a child and you didn't have to know it existed.

## 6. Guardrails

For anything aimed at children, tick **Child safety** and **Crisis / mental health**. These add
firm instructions and, where relevant, real UK helpline details. They cost nothing and the one
time they matter, they matter enormously.

## 7. Publishing

Tick **Published**, tick **Featured on home** if you want it on the front page, and save.

## Now test it properly

Open it and try to break it. Ask the thing your prompt forbids — *"just tell me the answer to
7 × 8"* — and check it holds the line. Ask something off-topic and see if it wanders.

If it misbehaves, go back to the **prompt**, not the model settings. Nine times out of ten the fix
is one more specific sentence about the case you just found.
