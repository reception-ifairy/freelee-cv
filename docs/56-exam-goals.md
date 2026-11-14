# 56 — Exam goals

**Owner decision, 2026-11-14.** In home education the exams a child works towards matter: GCSE at the end of school, and also International GCSE, Functional Skills and graded music, drama or dance exams. The parent picks a target exam in the child's profile and the plan works back from it.

The facts come from the curriculum's exams layer (curriculum `docs/EXAMS_2026-11.md`: `GET /v1/exams`, plan-pack `targets`, `GET /v1/exams/:id/practice`):
- 74 exams, 57 checked at the awarding body or gov.uk;
- never fees, dates, deadlines or grade boundaries.

## The exam list

**Fetch** on the Curriculum card also saves `curriculum_exams_cache` (`fetchExams()`, `src/lib/connections/registry.ts`). It holds, for each exam:
- identity, years, series, and tiers or levels;
- home-education access and barriers;
- which exams have practice papers.

Without a Fetch there is no list, and the form shows no exam section.

## In the profile

`targets` holds up to four entries `{ exam, sitting: 'YYYY-MM', tier?, level? }`. The form offers three. Each field has its note: why we ask, where it goes, how long we keep it (`FIELD_NOTES.targets`).
- **Which exams the form offers** (`examsForYear`, `src/lib/children/exams.ts`):
  - school tests and entrance only up to the year they are sat;
  - qualifications from Year 7;
  - graded exams always.
- **Tier or level:** only where the exam has one.
- **What a parent sees under the chosen exam:**
  - access, e.g. "Schools give this test; at home it is practice with the published papers";
  - barriers: coursework marked by a centre, a speaking test run by the centre, required practicals.
- **Server-side checks** (`childProfileSchemaFor(options, exams)`):
  - the exam is in the list;
  - the month falls between a year ago and six years ahead;
  - tiers and levels the exam lacks are dropped.

## What the curriculum receives

**The month stays in the sealed profile.** `buildPlan` (`src/lib/children/plan.ts`) sends `targets: [{ exam, atYear, series?, tier?, level? }]` (`targetRequest`):
- **`atYear`** is the school year the child will be in at the sitting. It is the profile's year moved on by the school years (September to August) between today and the sitting. A Year 9 child in November 2026 sits June 2028 in Year 10.
- **`series`** comes from the month (May–June summer, November, January). It is sent only when the exam offers that series.
- **`tier` and `level`** are sent only when the exam has them.

**When a goal cannot be planned:**
- a goal after Year 11 is not sent; the plan says so;
- if the curriculum refuses the goals (400), the plan is built without them, with a note to check them in the profile, so a stale goal never blocks a plan.

## In the plan, the dashboard and the lesson

**`plan.targets`** keeps the curriculum's answer for each goal, plus the profile's `sitting`:
- status (ahead, this year, past);
- the format for the tier or route (the exam-only route first);
- barriers;
- milestones in months before the exam;
- coverage: the topics and sessions from now to the exam year;
- the past-papers link, and notes.

**The parent's page** shows:
- each goal with its month and the months to go;
- the topics until then and the barriers;
- the curriculum's notes.

In September and October it asks the parent to check the year in each profile: goals are worked out from it.

**The lesson prompt** (`learnerSection`) gets at most two "Exam goal" lines: the exam, its tier or grade, months to go, and the papers with their minutes. A school test is marked "practice at home, not sat". One rule follows the lines:
- calm, untimed practice unless the grown-up asks;
- never a predicted score or grade;
- never pressure or failing;
- never coursework or any assessed work.

## `exam_practice`

In a child's lesson whose plan has a goal with practice papers (today the KS2 tests), the tutor gets the tool `exam_practice` (`examPracticeTool`, `src/lib/tools/registry.ts`):
- **One published question at a time:** KS2 grammar paper 1 or arithmetic, as the curriculum serves them. The curriculum never serves the extracted mark-scheme text.
- **Never one asked before:** the ids are kept in the sealed plan as `practiceSeen`, and saved after the reply.
- **Within the budget:** it shares the one-look-up-per-turn budget of the other curriculum tools.
- **No answer up front:** the tutor asks the question as written and lets the child answer first.

The lesson page, not the tutor, shows the Open Government Licence attribution of the STA material.

## Data

`docs/54-children-data.md` lists the new field and what goes where:
- the month stays in the profile;
- curriculum receives the exam id and school year and logs `exam-<id>`;
- the practice ids stay in the plan.

There is no migration: profiles and plans are sealed JSON.

## Checks

`npm run children:verify-exam-targets` (also part of `blocks:verify`) runs 12 checks:
- school years across September, months to go, series;
- what the pack receives (never a date);
- the exams offered per year;
- labels.
