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

## Image upload and generation

**Accept image uploads** lets people attach pictures to a message — up to four, 5 MB each. The
persona can then actually see them ("what's wrong with this diagram?"). Only tick it if the model
behind the persona supports images; most current ones do.

**Generate images** adds a *Create an image* box above the message area. Images are billed **per
picture**, not per message, and that price is set per model under **AI models**. A generated image
is saved and stays in the conversation.

Both are enforced on the server, not just hidden — a persona without the flag will refuse even a
hand-crafted request.

## Filter offensive input

Blocks messages containing terms on a list before they reach the AI, so a blocked message costs
nothing. Edit the list under **Settings → AI → Blocked words**; your list replaces the built-in one
entirely.

It is a **word list, not a moderation service.** It catches casual abuse and will not stop someone
determined. Don't rely on it as your only safeguard for a persona aimed at children — use it
*alongside* the guardrails on the Prompt tab.

## Allow embedding on other sites

Lets you drop the persona into any website:

```html
<iframe src="https://your-site/embed/your-persona-slug" width="420" height="560"></iframe>
```

The embedded version has no site navigation — just the persona and the conversation. Only personas
with this ticked can be embedded; every other page on your site stays un-embeddable.
