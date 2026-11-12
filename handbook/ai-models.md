# AI models

**Settings → Models.** Which models your personas can use, at what tier and price. Keys, and
the **Test** and **Fetch models** buttons, are one tab up in **Settings → Providers & keys**.

## Providers

| Provider | Needs | Notes |
|---|---|---|
| **OpenAI** | API key | The default. Also has image models. |
| **Anthropic** | API key | Claude. Strong at long documents and careful reasoning. |
| **OpenRouter** | API key | One key, hundreds of models from many vendors. |
| **Ollama** | A local server | Models on your own machine. No per-message cost, slower. |
| **Stability AI** | API key | Image generation only — catalogue only for now, see below. |

Keys go in **Settings → Providers & keys**, one card per provider. A key saved there overrides one
in the environment, so you can rotate a key without a deploy. The same page holds the services bots
use while they answer — web search, voice, and the Curriculum for tutors (see
[Tutors that teach from the curriculum](/admin/handbook/curriculum-tutors)) — with the same three
buttons.

## Save, Test, Fetch

Every provider card works the same way:

1. **Save** the key. Editing a box hides the other buttons until you save.
2. **Test** makes the smallest real request the provider offers and says, in plain words, whether
   it works — or whether the key was rejected, or the account has no credit left. The last answer
   is remembered, so you see it next time without paying for another test.
3. **Fetch models** appears once the test passes. It asks the provider what it offers right now and
   adds every model you don't have yet — no ticking.

Use Fetch rather than typing model names. Provider catalogues change constantly, and a hand-typed
model ID that's since been retired fails at the worst moment — mid-conversation, in front of a
customer.

Fetched models arrive as **Preview**, collapsed under "N preview models (not offered to
customers)" on the Models tab. That's deliberate: they're in your catalogue but not yet priced or
assigned a tier, and customers never see them. Fetch never changes a model you already have. If a
model you have is missing from the provider's list, Fetch only tells you — provider lists use dated
names while your catalogue often uses the short one, so it would be wrong to switch it off.

## Per-model settings

| Setting | What it does |
|---|---|
| **Tier** | Fast / Balanced / Advanced, or none. This is what personas actually select. |
| **Status** | Preview, Stable, Deprecated, Retired. Only **Stable** models are offered to personas. |
| **Credits per 1k tokens** | What you charge. Set this above what it costs you. |
| **Sort** | Display order. |

**Only one model per tier per provider.** Setting a second to Balanced replaces the first as what
Balanced resolves to.

## A safe way to introduce a new model

1. Fetch it — it arrives as Preview, invisible to personas
2. Set credits per 1k and a sort position
3. Set status to **Stable** but leave the tier empty — now selectable by name, but no persona
   switches to it automatically
4. Test it on one persona
5. Assign the tier, which moves every persona on that tier over at once

## Image models

Image-capable providers show a separate **Image models** section. You can catalogue them and store
the keys, but **nothing generates images yet** — the machinery isn't built. The catalogue is
groundwork, not a working feature.
