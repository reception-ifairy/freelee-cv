# Prompt tab

This tab decides who the persona is. If you only ever get one tab right, make it this one.

## System prompt

The instructions the AI receives before every single message. The user never sees this.

**Answer four questions and you have a working prompt:**

1. **Who are you?** — role, name, area
2. **Who are you talking to?** — expertise level, age, context
3. **How do you behave?** — structure, tone, method
4. **What do you never do?** — the hard limits

### Vague vs specific

Vague instructions do almost nothing. Compare:

| Weak | Strong |
|---|---|
| "Be helpful and friendly." | "Greet the person by name if they give it, and end each reply by offering one next step." |
| "Don't give bad advice." | "Never recommend a specific medication or dosage. Point to a GP or NHS 111 instead." |
| "Explain things well." | "Work through problems one step at a time and check understanding before continuing." |

The test: **could you tell whether it was obeyed?** If not, the instruction is decoration.

### Length

Aim for 150–400 words. Under 50 and the persona has no real character. Over about 800 and later
instructions start getting less attention than earlier ones — put the non-negotiable rules near the
top for that reason.

## Welcome message

Shown before anyone types. Do two things: say who you are, and ask a question. An open invitation
gets more use than a statement.

> *"Hi, I'm Lex. I read contracts so you don't have to. What have you got?"*

## Starter suggestions

Up to four clickable prompts. These matter more than they look — most people who open a chat and
see an empty box just close it again.

Make them *specific things a real user wants*, not categories:

- Good: *"Check my notice period clause"*
- Weak: *"Ask about contracts"*

## Cognitive blueprint (advanced)

An optional structured JSON block for very detailed personas. Leave it empty unless you have a
reason — everything it does can be done in the system prompt, in ordinary sentences, and that's
easier to read and fix later.

## Guardrails

Tick-boxes that add firm safety instructions, and where relevant real UK helpline details
(Samaritans, NHS 111, Childline). They are **prompt instructions**, not a filter — nothing scans
messages in code. They shape behaviour reliably but they are not a guarantee.

Tick every one that could plausibly come up. A maths tutor for children should have **Child safety**
and **Crisis / mental health** ticked even though maths has nothing to do with either — because the
child on the other end is a child regardless of the subject.
