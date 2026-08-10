# Settings, the model catalog, and provider health

## Settings was a strip of seven words

`general · ai · assistant · email · billing · analytics · localization` — no grouping, no
explanation, and the model catalog on a separate top-level page despite being configuration in
exactly the same sense. Setting up a provider took two screens that never referred to each other.

Now four headed groups, each section with an icon and a line saying what it controls:

| Group | Sections |
|---|---|
| Platform | General · Language · Analytics |
| AI | Providers & keys · **Models** · Site assistant |
| Money & messages | Billing · Email |
| Appearance | Branding & theme (its own route) |

The map is data in `src/lib/admin/settings-sections.ts`, so adding a section is one entry.
`/admin/ai-models` redirects into `?section=models`, and the old `?group=` parameter still resolves —
existing links, bookmarks and the handbook keep working.

## The model catalog, rebuilt

Same components as the rest of the admin instead of its own cramped markup:

- **Tier and status are dropdowns** (`GridSelect`), not `h-8` native selects, and **save on change**.
  There is no "Save" link at the end of the row to miss.
- **The default model is a dropdown of models actually registered** for that provider, not free
  text. Typing an id that does not exist was silent until every chat failed at request time.
- Each provider states whether its key is set and how many models it has.
- **"Add a model" is a dialog opened from the provider it belongs to.** It used to sit at the very
  bottom under every provider, so adding an OpenAI model meant scrolling past four others and
  choosing OpenAI again from a dropdown.

### Ollama is marked R&D only

Free, private, runs on this box — and measured here at roughly **9 tokens/second** on the 1B model
and **under 2** on the 3B, CPU-only. The card says so, and says what it *is* good for: testing
prompts, tools and new features, and research where sending data to a third party is the wrong
answer. Assign one to a customer-facing persona and the experience will be poor.

## Provider health — "key set" was a claim, not a fact

`src/lib/ai/health.ts` plus a **Test connection** button per provider. It makes the smallest real
completion the provider offers — deliberately **not** a model list, because listing succeeds in
exactly the state this is meant to catch — and classifies the result:

`no-key` · `bad-key` · `no-credit` · rate-limited · `ok`

It paid for itself twice on the first run:

1. **OpenAI authenticates and lists 200+ models while every completion returns "You have no credits
   remaining."** The admin had been showing "key set", which is true and useless.
2. **Ollama's default model was `llama3.2`, which is not installed** — the box has `llama3.2:1b` and
   `llama3.2:3b`. Any Ollama persona without an explicit model would have failed at request time.
   Fixed in the database and in the seed. This is precisely the class of bug the new
   "default model is a dropdown" control prevents.

Rate-limited to 20 tests a minute per admin: it spends real money, in tiny amounts.

## The OpenAI catalog was two generations behind

Registered models were `gpt-4o` / `gpt-4.1`. Replaced from the **live catalog this account actually
lists**: `gpt-5.4-nano`, `gpt-5.4-mini` (fast), `gpt-5.5` (balanced), `gpt-5.5-pro` (advanced), plus
the `o3` / `o4-mini` reasoning pair with no tier.

The old rows are marked **retired rather than deleted** — a persona may still reference one, and
deleting it would break that chat instead of saying so.

> ⚠️ **Registered but not verified end to end.** Nothing can run on that account until it has
> credit. Use **Test connection** once it is funded; the newer models are unproven here.

## Verified

| Check | Result |
|---|---|
| All eight settings sections | ✅ 200, correct heading |
| `/admin/ai-models` redirect | ✅ lands on `?section=models` |
| Old `?group=email` | ✅ still opens Email |
| Ollama card: badge, help, throughput figures | ✅ |
| Health across all six providers | ✅ no-credit / no-key ×3 / Google answers / Ollama answers |

## Still open

- **OpenAI Assistants (Playground) are not integrated.** The Assistants API is a different runtime
  from chat completions — threads, runs and polling rather than a stream — and it cannot be built
  honestly against an account that returns "no credits" to every request. It is the natural next
  step once the account is funded.
- No per-model cost import; credits per 1k are still set by hand from the provider's price list.
