# Translations

**System → Translations.** Running the site in a language other than English.

## How it works

English is never stored anywhere. Every piece of text in the interface sits in the code with its
English wording built in. Other languages are stored as translations *of* those pieces.

That has one very useful consequence: **a missing translation can never produce a blank page.** It
falls back to English. A half-finished language degrades; it doesn't break.

The site has **one language at a time**, set by you — it is not a per-visitor preference. The
public site and the admin panel have separate settings, so you can run a Polish shop front while
working in English yourself.

## The word bank

All the English text, grouped into **modules**: Navigation, Home page, Blog, CMS pages, Personas,
Pricing, Help tips.

The modules are not just tidiness. When you add a language, the AI translates **one module at a
time**. A single request carrying every string in the product drifts and quietly drops things; ten
small ones don't. If one module fails, the others still succeed and you retry just that one.

The table shows `done / total` per module per language, so you can see exactly where the gaps are.

## Adding a language

1. Type the language name — *"Polish"*, not a code
2. The AI works out the code and translates each module in turn
3. The language stays **frozen** until every module completes

Frozen means it cannot be selected as the site language. That's the point: a half-translated
language can't reach visitors. If it fails partway, press **Retry**.

## Export and import

For handing translation to a person instead of the AI.

**English is always on the left, the target language on the right**, one row per string. Untranslated
rows are included with an empty right-hand column — the gaps *are* the job list.

| Format | For |
|---|---|
| **CSV** | A translator. Opens in Excel or Google Sheets. |
| **JSON** | Re-importing here after review. |
| **SQL** | Applying a finished translation to another installation. |

Import accepts the file back. Importing a complete translation for a frozen language **unfreezes
it**.

## Changing site text

If you edit wording in the interface, the word bank needs rebuilding and the affected strings
re-translating. That's a developer task — the bank is generated from the code.
