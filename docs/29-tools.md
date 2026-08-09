# Tool calling

Added 2026-08-09. Until now a persona could only ever **talk**. Knowledge sources let it read,
guardrails shaped what it said, personality changed how it sounded — but nothing let it *compute*
or *act*. Asked to multiply two five-digit numbers, a model guesses, confidently, and is often
wrong. Tools close that gap.

## The shape

Static registry (`src/lib/tools/registry.ts`), same distinction the AI provider registry draws:
**a tool is code** — it has an implementation, a schema and a failure mode, so it can't be a DB
row. *Which* tools a persona may use is data (`persona_versions.tools`, migration 0026).

Wired into `streamText` as the AI SDK's `tools` option. `stopWhen: stepCountIs(5)` matters — without
it the model calls a tool and the turn ends there, leaving the user staring at nothing. Each step is
a model round trip, so the cap bounds latency and cost; five covers call → read → call again →
answer.

An unknown key in the column is skipped rather than throwing: removing a tool from the registry
must not break every persona that still lists it.

## The first five, all key-free

Deliberately no API keys in the first set, so the whole path is verifiable without signing up for
anything. API-backed tools (search, weather, market data) slot into the same shape.

| Tool | What it fixes | Suggested for |
|---|---|---|
| **Calculator** | Models guess at arithmetic | Finance, Science, Engineering, Education, Tech |
| **Unit converter** | Half-remembered conversion factors | Engineering, Science, Health, Travel, Education |
| **Date calculator** | Date maths across month/year boundaries | Travel, Business, Legal, HR |
| **Text statistics** | "How long is this?" — estimated, not counted | Writing, Marketing, Creative, Translation |
| **Dice & random choice** | Models cannot produce real randomness | Entertainment, Creative |

The last one is genuinely useful for the Gamebook layout (docs/23): a model asked to "roll for it"
will unconsciously favour dramatic outcomes. `Math.random()` will not.

Tools are pre-ticked on a new persona from its categories (`suggestedToolsFor`), which is what makes
this **category-specific** rather than a flat list everyone gets.

## The calculator does not use `eval`

Its input comes from a language model, which is influenced by whatever a user typed — untrusted by
construction. `eval` or `new Function` there would be remote code execution behind two layers of
indirection.

`src/lib/tools/expression.ts` is a hand-written shunting-yard parser that understands numbers, five
operators, parentheses and a fixed function list, and **can express nothing else**. No dependency
either: a maths library would be more capable and also a supply-chain surface for the one place
here that evaluates model-influenced input.

Verified on 20 cases, including operator precedence, right-associative `^`, unary minus, and
rejection of `alert(1)`, `process.exit(1)`, `__proto__`, unbalanced parens and division by zero.

## Verified end to end

A Gemini persona with calculator + unit converter, asked *"What is 48239 × 7713? Then convert
12.5 kg to pounds."*

- Product: **372,067,407** — correct
- Conversion: **27.557783 lb** — exactly the converter's six-decimal output format, which is the
  tell that the tool ran rather than the model recalling an approximation

Worth recording: the first run *looked* like a failure because the test asserted 372,187,407. The
test was wrong, the model was right. Checking the arithmetic before believing the assertion is the
only reason that wasn't logged as a bug.

## Next

The obvious additions are API-backed and need keys: web search (Tavily/Brave), weather, currency
rates, company lookup. Each is one entry in the registry plus a `needsKey` guard.
