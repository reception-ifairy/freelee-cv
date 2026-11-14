# 55 — The subject dictionary

**Owner decision, 2026-11-14.**
- freelee, the curriculum and the iFairy Academy use **one list of subjects**.
- Subjects may **overlap**: biology, chemistry and physics are subjects of their own, as in Poland and at GCSE, and also parts of science.
- Every part of a subject has the kind of screen it needs. This is the curriculum's `domain → interface` layer, carried in each plan.

The dictionary lives on the curriculum (`docs/SUBJECTS_2026-11.md` there: `content/subjects.json`, `GET /v1/subjects`). freelee mirrors it.

## What freelee keeps

**Fetch** on the Curriculum connection card saves two things: the scope, as before, and the dictionary, as `curriculum_subjects_cache` in `settings` (`fetchSubjectsDictionary()`, `src/lib/connections/registry.ts`). The copy is compact:

| Field | What |
|---|---|
| `options` | each subject: `id` (the curriculum's own name, e.g. `art and design`), short `label`, `partOf` (biology → science), `from` and `to` years, `childSelectable`, `sensitive` |
| `aliases` | other spellings that are a subject: synonyms and courses (`maths`, `combined science`) |
| `parts` | spellings that are a part of a subject (`english reading`, the STA test papers → `english`). Used to match tutors, never offered to a parent. |

The assignments of units, objectives and learning areas, and the interfaces, stay on the curriculum, which applies them in every plan.

**Fallback:**
- **Before the first Fetch, or on a curriculum without `/v1/subjects`,** `FALLBACK_SUBJECTS` stands in. These are the sixteen subjects freelee offered before, so nothing breaks; the Fetch summary says which applies.
- **A broken cache** reads as null and the fallback applies.

## Where it is used

The module is `src/lib/curriculum/subjects.ts`, a plain module also imported by the child form. `src/lib/curriculum/subjects-cache.ts` reads the cache on the server.

| Place | What changes |
|---|---|
| **Child form** (`dashboard/children/child-form.tsx`) | The subjects of the chosen year come from the dictionary. A part says what it belongs to ("Biology · part of Science"), and a line explains that choosing both is fine: each topic is planned once. PSHE stays its own consent. |
| **Saving a profile** (`childProfileSchemaFor(options)`, `src/lib/children/store.ts`) | Each subject must be one a parent can choose and offered in the child's year. This is now checked on the server too, not only in the form. Saved profiles already use the curriculum's names, so there is no migration. |
| **Lesson prompt** (`learnerSection`, `src/lib/children/plan.ts`) | The plan subjects a tutor teaches are matched through the dictionary (`sameFamily`). A science tutor teaches the child who chose biology, and a tutor scoped to `english reading` teaches English. Without a dictionary, an exact name match still works. |
| **Child's lesson page** (`/learn`) | Subjects of the child's plan that no tutor teaches yet are named ("No tutor for Biology yet") instead of being left out silently. Tutors are still listed by key stage. |
| **Plans** | Units carry `domain` and learning areas carry `domains` and `interface`. Plans also keep the pack's `domains` and `interfaces`, with the tools for the child's year. Until freelee builds a screen for an interface, a lesson stays a chat. |
| **Labels** | One `subjectLabel(id, options)` replaces three copies. |

**Not changed:**
- **The tutor's search filter** (`src/lib/tools/registry.ts`) still matches subjects exactly. Widening it (e.g. `english` also finding `english reading` documents) changes what a tutor sees, so it is a separate decision.
- **The admin tutor picker** still lists the raw subject names of the scope.

## Checks

`npm run curriculum:verify-subjects` (also part of `blocks:verify`) runs 13 checks of the rules on a dictionary shaped like the curriculum's:
- synonyms and parts;
- overlapping subjects and tutor matching;
- years and the PSHE exclusion;
- labels;
- the fallback and the cache parser.

It needs no network and no database.
