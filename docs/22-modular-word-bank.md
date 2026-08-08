# Modular Word Bank & Help Tips

Shipped 2026-08-08. Rebuilds the translation module (docs/17-translations.md) around a **modular
word bank**, resets the platform to English-only, and rebuilds Polish from scratch against a bank
that is actually complete. Also adds the `?` help-tip system.

## Why this pass happened

The word bank was extracted by a script holding a **hand-maintained list of files**. When the home
page was refactored into `src/components/site/sections/*` (docs/19-frontpage-sections.md), the
registered path — `src/app/(marketing)/page.tsx` — kept existing, so nothing errored. It just
silently stopped finding ~20 keys. The bank had been quietly wrong for two days, and both Polish
and German had been generated from it.

That's the class of bug this pass is built to prevent, not just fix.

## The bank is now modular

Every key is `<namespace>.<name>`, and the prefix *is* the module
(`src/lib/i18n/namespaces.ts`). Ten modules: `common`, `nav`, `home`, `blog`, `pages`, `personas`,
`pricing`, `auth`, `help`, `admin`. One bank file each (`i18n/home.en.json`, …).

This is not filing-cabinet tidiness — it changes three real behaviours:

1. **Translation happens one module per AI request.** A single request carrying every string in the
   product drifts, truncates, and drops keys as the product grows. Ten focused requests of ~10–20
   keys each do not.
2. **A failure is contained.** If `pricing` fails, the other nine still land, and the admin retries
   just that one. Previously one bad response lost everything.
3. **A locale only unfreezes when every module succeeded.** A partly-translated language stays
   `pending` (frozen) rather than leaking English gaps onto the live site — `runTranslationPipeline`
   in `src/server/actions/admin-translations.ts` enforces this, and reports which modules failed.

## The extractor can't go stale again

`scripts/extract-translations.ts` now **walks the whole `src/` tree** instead of reading a file
list. The original objection to a blind scan — that an unrelated `t()` would be picked up — is
handled structurally instead: a call only counts if its key's prefix is a known namespace. Nothing
else in this codebase calls a one-letter function with a dotted, namespace-prefixed string literal.

It also **strips comments before matching**. Without that, a doc comment *describing* the pattern
(`lives here as literal t('help.…', 'English')` in `src/lib/help/topics.ts`) was scanned as a real
call site and put a junk `help.…` key in the bank — which then got sent to the translator. Caught
on the first full extraction of this pass; the fix is in the scanner, not the comment.

## Coverage

88 keys across 7 populated modules, up from a stale 32. This pass added `t()` coverage to the blog
index and post pages, CMS pages, the persona catalog, and the whole pricing page (including the
FAQ, which had to become a function of `t` — a module-level `const` is evaluated before any
translator exists). `header.*`/`footer.*` keys were folded into `nav.*`; they predated the
namespace design and would otherwise have been skipped by the structural guard.

## Export: English left, target right

`src/lib/i18n/export.ts` defines one contract every format obeys — **English on the left, the
target language on the right, one row per string, both sides always present.** Untranslated keys
are included with an empty right-hand side, because the gaps *are* the work list.

- **CSV** — what a non-technical translator actually opens (Excel/Sheets), two columns side by side.
- **JSON** — re-importable here; the round-trip a coworker workflow depends on.
- **SQL** — re-runnable `INSERT … ON CONFLICT` for applying a finished translation to another
  environment. English is emitted as a `--` comment above each row, never as data (it is never
  stored in `translations`), so a human reading the file still sees what each row translates.

`importTranslationsAction` accepts both the side-by-side shape and the older flat
`{namespace,key,locale,value}` array. Rows with an empty translation are skipped rather than
written as empty strings — an empty value would shadow the English fallback with nothing.

**Bug found and fixed during verification:** the import created *unknown* locales as `active` but
left an existing `pending` one frozen. A complete, hand-reviewed translation imported for a locale
that a failed AI run had left frozen therefore couldn't unfreeze it — the exact recovery path the
feature exists for. Import now activates both cases and reports which languages it unfroze.

## Help tips (`?`)

`src/components/ui/help-tip.tsx` — a `?` icon that opens a short explanation, used across the
frontpage editor, persona browse, pricing, and the translations panel.

Deliberately split in two halves with different lifecycles:
- **Text** lives in code as literal `t('help.…')` calls (`src/lib/help/topics.ts`), so the
  translation pipeline can see and translate it. DB-stored help text would be invisible to it.
- **Video** is `help_topics.video_url` (migration `0020_help_topics.sql`) — admin-supplied data.

The instructional-video feature itself is **not built**: this is the schema and the render slot it
will land in. Every topic today has no row at all and renders as text only, which is the correct
state, not a broken one. There is deliberately no "video coming soon" placeholder.

## Current state

English is the live frontend language. Polish is complete (88 strings, `active`) and one click away
in `/admin/translations`.

**The automated AI translation could not be run this pass** — the platform's configured OpenAI key
returned "You have no credits remaining", and no other provider key is set. The per-module pipeline
was still exercised end-to-end by that failure and behaved correctly: each module failed
independently, zero rows were written, and Polish was left frozen rather than half-applied. The
Polish translation shipped here was produced directly and loaded through the real import path,
which also verified the export → import round-trip. Once the OpenAI account has credit, "Add a
language" in `/admin/translations` runs the same pipeline unchanged.

## Verifying it

```bash
npm run i18n:extract                              # rebuild every bank file
npx tsx scripts/translate-bank.ts --locale=pl     # all modules
npx tsx scripts/translate-bank.ts --locale=pl --module=blog
```
Then in `/admin/translations`: the word-bank table shows per-module `done/total` per language, and
Export offers language + format dropdowns.
