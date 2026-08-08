# Model tab

Which AI engine does the thinking, and how much freedom it has.

## Tiers — the recommended way

Three choices: **Fast**, **Balanced**, **Advanced**.

A tier is not a fixed model. It's resolved fresh on every message from your
[AI models](/admin/handbook/ai-models) catalogue. That means when a provider renames or retires a
model — which happens several times a year — your personas keep working and you do nothing.

| Tier | Use it for | Roughly |
|---|---|---|
| **Fast** | FAQs, simple lookups, high volume | Cheapest, quickest |
| **Balanced** | Almost everything | The sensible default |
| **Advanced** | Complex reasoning, long documents, nuance | Several times the cost |

**Start on Balanced.** Move a persona to Advanced only when you can point at a specific answer it
got wrong that a better model would have got right. Moving everything to Advanced "to be safe"
multiplies your costs for a difference most users never notice.

## Choosing a specific model

Click *Choose a specific model instead* to pin an exact model. Two costs to accept:

1. If that model is retired, the persona breaks and you have to fix it by hand.
2. You lose the automatic upgrade when a better model appears in that tier.

Worth it when a persona genuinely depends on one model's particular behaviour. Not worth it
otherwise.

## Temperature

How much the AI varies its wording. **0** = nearly identical answers to the same question every
time. **2** = wild.

| Setting | Good for |
|---|---|
| 0.2–0.5 | Legal, medical, compliance, support — anywhere consistency matters |
| 0.6–0.9 | Most personas |
| 1.0–1.4 | Brainstorming, creative writing, storytelling |

Above about 1.5 replies start to lose the thread. There is very rarely a good reason to go there.

## Max tokens

A ceiling on reply length. Leave blank for the provider default. Set it if a persona is
long-winded and you want to cap cost per message — but a sentence in the prompt ("keep answers
under 200 words") usually produces a better-shaped reply than a hard cutoff, which just stops
mid-sentence.

## History messages

How many previous messages are re-sent with each new one. Default **8**.

This is the setting people misunderstand most. Higher means the persona remembers more of the
conversation — and **every one of those messages is paid for again, every turn**. Going from 8 to
30 roughly quadruples the cost of a long conversation.

- **4–6** — support and FAQ, where each question stands alone
- **8** — the sensible default
- **15–30** — tutoring, therapy-adjacent, long collaborative writing, where forgetting is the
  bigger problem
