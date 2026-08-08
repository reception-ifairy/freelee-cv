# How credits work

Credits are what your customers spend to talk to your personas.

## What a message costs

Not a flat fee. Cost depends on how much text the AI actually processes, which is:

- **The reply itself** — longer answers cost more
- **The conversation so far** — the last few messages are re-sent every turn so the persona
  remembers context
- **The system prompt** — your instructions, sent every single time
- **The model** — an Advanced-tier model can cost ten times a Fast one

## The consequence people miss

**Long conversations get more expensive as they go.** Message 20 costs more than message 2, because
it carries more history with it.

Two settings control this, both on the persona's [Model tab](/admin/handbook/persona-model):

- **History messages** — how many previous messages are re-sent. The default 8 is a good balance.
  30 is roughly four times the cost on a long chat.
- **Max tokens** — a hard ceiling on reply length.

And a third thing you write: **a long system prompt is paid for on every message.** A 1,000-word
prompt is a permanent tax on every reply that persona ever gives. Tighten it.

## Free credits

**Settings → AI** has two:

- **Free messages before signup** — how many a visitor gets before being asked to register.
  Enough to see value, not enough to never need an account. Three to five is typical.
- **Signup bonus credits** — granted on registration.

## Where credits come from

Customers buy them, or you grant them. Grants are on the customer's page under
**Commerce → Customers** — useful for support, apologies and testing.

## Keeping an eye on cost

**Commerce → Sales** shows what came in. Each customer's page shows their balance and history,
itemised per message, so an unexpectedly expensive conversation can be traced to the persona that
caused it.

If costs run high, check in this order: system prompt length, history messages, model tier. In
that order — the first is free to fix and usually the culprit.
