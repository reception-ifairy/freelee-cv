# AI models

**AI → AI models.** Which providers you're connected to and which models your personas can use.

## Providers

| Provider | Needs | Notes |
|---|---|---|
| **OpenAI** | API key | The default. Also has image models. |
| **Anthropic** | API key | Claude. Strong at long documents and careful reasoning. |
| **OpenRouter** | API key | One key, hundreds of models from many vendors. |
| **Ollama** | A local server | Models on your own machine. No per-message cost, slower. |
| **Stability AI** | API key | Image generation only — catalogue only for now, see below. |

Keys go in **Settings → AI**. A key set there overrides one in the environment, so you can rotate
a key without a deploy.

## Fetch models

Each provider card has a **Fetch models** button. It asks the provider what models it currently
offers and shows them as a checkable grid. Tick the ones you want and import.

Use it rather than typing model names. Provider catalogues change constantly, and a hand-typed
model ID that's since been retired fails at the worst moment — mid-conversation, in front of a
customer.

Imported models arrive as **Preview**. That's deliberate: they're in your catalogue but not yet
priced or assigned a tier. You do that next.

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

1. Fetch and import it — it arrives as Preview, invisible to personas
2. Set credits per 1k and a sort position
3. Set status to **Stable** but leave the tier empty — now selectable by name, but no persona
   switches to it automatically
4. Test it on one persona
5. Assign the tier, which moves every persona on that tier over at once

## Image models

Image-capable providers show a separate **Image models** section. You can catalogue them and store
the keys, but **nothing generates images yet** — the machinery isn't built. The catalogue is
groundwork, not a working feature.
