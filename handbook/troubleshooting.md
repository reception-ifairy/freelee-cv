# When something looks wrong

Check things in this order. It's roughly cheapest-and-most-likely first.

## A persona gives bad or off-topic answers

1. **Read the prompt as if you were the AI.** Is the rule it broke actually written down, in
   specific terms?
2. **Check for contradictions.** "Be thorough" and "keep it under 100 words" can't both win.
3. **Check prompt length.** Past about 800 words, later instructions get less attention. Move the
   important rules up.
4. **Only then** consider a higher model tier.

## A persona won't stay in character

Personality sliders nudge; the prompt decides. If the prompt doesn't describe the character, ten
sliders won't create one. Also check you haven't set every slider high — that produces mush, not
character.

## Replies are cut off mid-sentence

**Max tokens** is set too low on the Model tab. Clear it, or raise it. If you wanted shorter
replies, ask for them in the prompt instead — that produces a complete short answer rather than a
truncated long one.

## Costs are higher than expected

In order:
1. System prompt length — paid on every single message
2. History messages — default 8; check nobody raised it
3. Model tier — is this persona really on Advanced?
4. **Commerce → Customers** — an individual's history is itemised per message

## A knowledge source cites nothing

Use **Test connection** on the source. If the test returns nothing, the problem is the connection
or the dot-paths, not the persona. Check the results path points at the array of hits, and that
the text path points at where the actual text lives inside each hit.

## The site is in the wrong language

**System → Translations** shows the current language for the public site and the admin panel
separately. They're independent — the shop front can be Polish while you work in English.

## A language won't activate

It's frozen because at least one module didn't translate. The word-bank table shows `done / total`
per module — find the incomplete one and press **Retry**. This is deliberate; a half-translated
language can't reach visitors.

## Something on the home page looks wrong

**Content → Frontpage**, and hit the eye icon to hide the offending block. Fastest possible fix,
fully reversible, and it buys you time to work out the real problem.

## A change didn't appear

- Personas with **version pinning** on need **Publish**, not just Save
- A persona with **Published** unticked is invisible to everyone but you
- A model must be **Stable** to be offered — Preview models are catalogued but not selectable

## Nothing can be bought

No payment gateway is configured. The pricing page will say so. Add Stripe or PayPal keys.

## Still stuck

The engineering documentation under **System → Documentation** covers how each part actually
works, including the decisions and the known gaps. It's written for developers, but the "what's
deliberately not built" notes are often the fastest answer to "why doesn't this do anything".
