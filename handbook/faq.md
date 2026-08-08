# FAQ

## About personas

**How many should I have?**
Fewer, better ones beat many thin ones. Five personas with carefully written prompts are more
useful than thirty generic ones, and a short catalogue is easier to choose from.

**Can two personas share a prompt?**
Not directly. Duplicate the text and adjust it. In practice you'll want them to diverge anyway.

**Why does mine ignore my instructions?**
Usually one of three things:
1. The instruction is too vague to obey — "be helpful" isn't checkable
2. It contradicts something else in the prompt
3. It's buried at the bottom of a very long prompt. Put hard rules near the top.

**Can I stop it answering off-topic questions?**
Say so explicitly: *"If asked about anything other than X, say that's outside what you cover and
offer to help with X instead."* Vague framing won't do it.

## About cost

**Why is one persona so much more expensive?**
Check, in order: system prompt length (paid on every message), history messages (default 8), and
model tier. The first is free to fix and is usually the answer.

**Why do long conversations cost more per message?**
Previous messages are re-sent each turn so the persona remembers. More history, more cost. Lower
**History messages** if that trade isn't worth it.

**Do credits expire?**
No. Bought credits stay until spent. Access passes expire; credits don't.

## About the interface

**Why does one chat look different?**
Chat layouts. Each persona gets one suited to its subject and audience — a children's tutor gets
big tappable prompts, a legal persona gets a dense document view. See
[Capabilities](/admin/handbook/persona-capabilities).

**How do I make a story persona?**
Set its chat layout to **Narrative**, **Screenplay** or **Gamebook**. Those change the reply format
itself, not just the styling — Gamebook ends every reply with tappable numbered choices.

**Can users change the tone?**
If you tick the tone, writing-style or output-format capabilities. They then get a *How should it
reply?* panel that also lets them set interaction style and how it handles things it doesn't know.
Their choices apply to their conversation only.

## About rooms and crews

**Why don't personas talk to each other in rooms?**
By design. They reply only when @mentioned. Personas replying to personas turns into noise very
quickly. If you want them working together autonomously, that's a crew.

**Can I have a room with no people?**
That's a crew. See [One assistant, or a team?](/admin/handbook/one-bot-or-a-team).

**How do I stop a crew running up a bill?**
Set its credit budget and maximum turns. Both are caps, and both stop it dead. Set them before the
first run, not after.

## About content and languages

**Can I reorder my home page?**
Yes — **Content → Frontpage**. Move, hide or edit each block.

**Can I run the site in another language?**
Yes. **System → Translations**, type the language name, and the AI translates module by module. A
language stays frozen until it's complete, so visitors never see a half-translated site.

**Can a translator do it instead?**
Export as CSV — English on the left, the target language on the right — and import the file back
when it returns.

## Things that don't work yet

**Image uploads and image generation.** Both switches exist on the Capabilities tab; neither does
anything. The underlying machinery isn't built.

**Embedding on other sites.** The switch exists, there's no embed route behind it.

**Offensive-input filtering.** Also has no code behind it. Use guardrails on the Prompt tab, which
genuinely shape behaviour.

These are listed rather than hidden so you don't spend an afternoon working out why ticking one
changed nothing.
