# Release notes

What changed, in plain words, one release per day of work — newest first. Each release says what is
different for the owner and for customers, lists the updates it is made of (their full reasoning is
in [`CHANGELOG.md`](CHANGELOG.md), one entry per commit), names the docs that explain it, and records
what was changed **outside git** — on the live database or server — so nothing that shaped the site
is invisible in the repository.

These notes start on 2026-11-11. Earlier history is in the CHANGELOG. The same text is published as
[GitHub Releases](https://github.com/reception-ifairy/freelee-cv/releases), tagged `vYYYY.MM.DD`.

---

## v2026.11.16 — The categories are the pillars, and one layout for the whole admin

Updates #88–#93 · tag `v2026.11.16` → `6860ddb`

**In short**

- **The categories are the pillars.** The sidebar opens with all twenty categories, each with its
  colour and how many of its bots are live; empty ones are dimmed. The six "markets" worked out from
  audiences are gone — old links land on the matching category.
- **Homeschooling lives under Education and Training**, with the homeschool hub (Tutors, Curriculum,
  Families) as that category's tabs and a link to the public */homeschooling* page. Business and
  Finance links */business*.
- **A category opens in the taxonomy browser**, with the tree still on the left and its own tabs:
  Bots, Sectors, Audiences, AI agent and Brief.
- **Every category has an AI agent** on Anthropic (Claude Opus 5.5). It knows the field and every bot
  in it, and proposes new bots, sector descriptions and audience groups; nothing changes until you
  approve (a new bot is always an inactive draft). The cost of each conversation is on screen. It
  needs an Anthropic key in Settings → Integrations.
- **One list of bots, in the taxonomy's layout.** *Personas* and *Drafts* open the taxonomy browser
  (Drafts is it filtered to bots that are not live), and a bot's card can publish, feature, duplicate
  and delete it. **Prompt modifiers** use the same layout: types on the left, the list, a card.
- **Commerce in the same layout.** Packs, plans, passes, sales, customers, marketplace and leads:
  statuses with counts on the left, the list, a card with its actions. Marketplace now shows rejected
  and suspended listings too.
- **Site, Knowledge and Teamwork too** — pages, blog, showcase, menus, library, shelves, external
  sources, bot teams, rooms and projects. Every list in the sidebar now looks and works the same way.
- **Integrations live in Settings.** Connections is now *Settings → Integrations*: the groups in the
  Settings tree with how many of their connections work, a list with each one's health, and the
  connection's card (Save → Test → Fetch) beside it. Settings' menu is a tree like the taxonomy's. Old
  links still open the right card.

**Updates**

| # | Commit | What |
|---|---|---|
| #88 | `56eaa85` | The categories are the pillars: twenty in the sidebar, homeschooling under Education and Training, the computed markets gone |
| #89 | `bfba892` | Every category gets its AI agent on Anthropic: it knows the field and its bots, proposes, and the owner approves |
| #90 | `9e987f5` | Catalogue in the taxonomy's layout: one list of bots, Drafts as its filter, prompt modifiers with a rail and cards |
| #91 | `6e1397d` | Commerce in the taxonomy's layout: statuses on the left, the list, a card — packs, plans, passes, sales, customers, marketplace, leads |
| #92 | `2d62468` | Site, Knowledge and Teamwork in the taxonomy's layout: every list in the sidebar now has the rail, the list and the card |
| #93 | `6860ddb` | Settings as a tree, with Integrations inside it: Connections moves into Settings, old links open the right card |

**Docs:** `57-admin-navigation.md`; handbook *Taxonomy*, *Child profiles*, *Welcome*, *Settings*, *Persona cards*, *First persona*, *Bot teams*, *Packs, plans and passes*, *Knowledgebase*, *AI models*, *Tutors that teach from the curriculum*.

**Not checked yet:** the category agent has not answered a single question — there is no Anthropic
key, so no paid call was made. Lists with no rows on this site (orders, leads, marketplace listings,
plans, passes, showcase, external sources, rooms, projects) were seen only empty.

**Changed outside git:** nothing.

---

## v2026.11.14 — Homeschooling foundations, and an admin you can find your way around

Updates #74–#86 · tag `v2026.11.14` → `ff905e5`

**In short**

- **One subject list, shared with the curriculum.** Subjects that overlap are allowed, as in many
  school systems: biology, chemistry and physics are parts of science. Each subject carries the
  school years it is taught in. A tutor for science also counts for a child who chose biology.
- **Exam goals.** A parent can give a child up to three target exams:
  - GCSE, International GCSE and Functional Skills;
  - graded music, drama and dance exams;
  - school tests.

  The child's plan works back from the exam date, and the tutor practises the exam's format with
  published KS2 questions.
- **Honest data.**
  - **Prompts:** a bot's prompt now describes only people of its own kind. A consumer tutor no
    longer tells the model it serves universities.
  - **/homeschooling:** the public page says tutors are in preparation instead of promising one per
    subject.
  - **Education:** the Education field now serves families and learners, at risk level R2.
- **The admin, redesigned around how it is used.**
  - **Taxonomy browser:** a tree of fields and sectors, the bots in a table, and a card that slides
    in on demand.
  - **Six markets:** worked out from who each bot serves — Business, Homeschooling & family,
    Schools, Adults, Interests and Public sector.
  - **Field workspace:** each field has one, with audience notes you can edit.
  - **Homeschool hub:** tutors, a who-teaches-what grid against the curriculum, and families as
    numbers only.
  - **Sidebar:** grouped by job and folding where you left it.
  - **Dashboard:** opens with what needs your attention.
  - **Connections:** one page for every key and outside service.

**Updates**

| # | Commit | What |
|---|---|---|
| #86 | `ff905e5` | Every connection on one page, and Settings holding only values — one home per key |
| #85 | `80fbf49` | The dashboard opens with what needs your attention, the markets beside it, and a header badge when someone is waiting |
| #84 | `1197c5d` | The sidebar by job, folding where you left it, and breadcrumbs that name what they show |
| #83 | `a2d5ce4` | The homeschool hub: tutors, the curriculum with a who-teaches-what grid, and families as numbers only |
| #82 | `0a5ffdd` | A field's workspace in three tabs: an overview that links into the browser, audiences with notes you can edit, the AI workbench |
| #81 | `04b4738` | Six markets worked out from who each bot serves |
| #80 | `61643cc` | The taxonomy as a browser: a tree, a table, a card on demand |
| #79 | `d4dc1d1` | Admin lists keep a tree selection, sort by column header and mark the open row; tabs as one component |
| #78 | `bd71a99` | Admin building blocks: a card that opens on demand, sections that fold, one focus trap |
| #77 | `5f56253` | Honest data: a prompt names only its own kind of people, the homeschooling page says tutors are coming, Education serves families |
| #76 | `84806ec` | Admin fixes before the redesign: the category filter, breadcrumbs, live counts, Drafts, the workbench |
| #75 | `c57a706` | Exam goals in a child's profile: the plan works back from them, the tutor practises the format |
| #74 | `1bd416f` | One subject list with the curriculum: overlapping subjects, years, tutors matched through it |

**Docs**
- Engineering docs:
  - `55-subject-dictionary.md` and `56-exam-goals.md`;
  - `57-admin-navigation.md`: the whole redesign;
  - `49-taxonomy-workbench.md`, `54-children-data.md` and `51-connection-checks.md`.
- Handbook: *Taxonomy*, *Child profiles*, *Settings*, *Welcome* and *Content*.

**Changed outside git**
- **Two characters deleted.** The Pan Kleks and Rogota personas were deleted at the owner's request,
  when character work was dropped. They were backed up on the server first.
- **Migration `0043_education_home_audiences.sql`** was applied. It is data only: Education gains 12
  learner and family audience groups and risk level R2.
- **The `/homeschooling` page** was rewritten in the live CMS by
  `scripts/update-homeschooling-copy.ts`, after the old blocks were backed up on the server.
- **Curriculum lists fetched.** The subject dictionary and the exams list were fetched from the
  curriculum into settings.
- **Live-test data removed.** Every live test used temporary data and removed it afterwards: a test
  parent account, a test lead, and a note edit restored from backup.

The curriculum side of this release is the curriculum repository's `v2026.11.14`: the subject
dictionary, the exams layer, plan-pack targets and practice questions.

---

## v2026.11.13 — Two offers on the site, and each school year on its own

Updates #71–#73 · tag `v2026.11.13` → `abfe7f0`

**In short**

- **Two offers, two pages.** What freelee sells is now two offers, each with its own page in the
  menu and footer: specialist bots **For business**, and AI tutors for **Homeschooling** families.
- **Tutor rules, written down.** The curriculum connection is written up as the standard every
  tutor follows: the system on one page, every call, how a lesson runs, what it costs, and a
  checklist for importing characters.
- **Each school year on its own.** A lesson carries its school year's own limits from the
  curriculum's year profiles, not just its developmental level. For example, a Year 3 child gets a
  Year 3 lesson.

**Updates**

| # | Commit | What |
|---|---|---|
| #73 | `abfe7f0` | Each school year on its own: a lesson carries the year's limits, not the level's |
| #72 | `fe3ebbc` | Two offering pages, For business and Homeschooling, in the menu and footer |
| #71 | `d222449` | The curriculum connection documented as the standard for every tutor |

**Docs:** `52-curriculum-tutors.md`, `53-tutor-measurement.md`; handbook *Tutors that teach from the
curriculum*, *Content*.

**Changed outside git**
- **Offering pages created.** Both pages were created on the live site by
  `scripts/seed-offering-pages.ts`. The script never overwrites an existing page.
- **Email went live.** freelee.cv started sending email through Resend. The account and DNS were set
  up from the T1000 panel.

---

## v2026.11.12 — Tutors that teach from the curriculum, and children's data done properly

Updates #65–#70 · tag `v2026.11.12` → `ce8b4f3`

**In short**

- **Tutors teach from the curriculum.**
  - **Live source:** they teach from the live UK curriculum (curriculum.ifairy.co.uk), within a
    scope set on both sides.
  - **One look-up:** each lesson turn makes at most one look-up.
  - **Characters:** a character carries only its voice; the knowledge comes from the curriculum.
- **Baseline Tutor and a bench.** Baseline Tutor is a plain tutor used as a measuring stick, and a
  bench measures tutor turns through the real chat.
- **Adults-only accounts.** Each account needs an 18+ declaration and a confirmed email.
  - **Children are profiles** under the parent's account, each encrypted with a key of its own.
  - **Every profile field says** why it is asked, where it goes and how long it is kept.
  - **Sign-up works again:** it had been failing for everyone.
- **One plan per child.** Each child has one learning plan built from the curriculum's plan pack.
  - **Child mode:** `/learn` is the mode a parent hands the device over in.
  - **Sealed lessons:** lessons are sealed with the child's key.
- **Parents stay in control.**
  - They can read every lesson and export everything.
  - Lessons are kept 90 days and profiles 12 months.
  - An account can be deleted.
  - A data-protection impact assessment is drafted.
- **Measured.** A lesson with the child's plan costs about half as much:

  | Per turn | Before | After |
  |---|---|---|
  | Credits, average | 111 | 59 |
  | Worst turn, credits | 216 | 82 |
  | Empty replies | some | none |

**Updates**

| # | Commit | What |
|---|---|---|
| #70 | `ce8b4f3` | Measured: a lesson with the child's plan costs half, and never loops |
| #69 | `0909a45` | Parents read lessons and export everything, notes used once, retention, account deletion, DPIA |
| #68 | `2b8e9de` | One learning plan per child, child mode, and lessons sealed with the child's key |
| #67 | `3857eaf` | Adult accounts with encrypted child profiles, and sign-up works again |
| #66 | `77adb8d` | A plain Baseline Tutor and a bench that measures tutor turns through the real chat |
| #65 | `29c8d16` | Tutors teach from the live UK curriculum, within a scope set on both sides |

**Docs:** `52-curriculum-tutors.md`, `53-tutor-measurement.md`, `54-children-data.md`; handbook
*Tutors that teach from the curriculum*, *Child profiles and privacy*.

**Changed outside git**
- **Migrations applied.** `0040_persona_curriculum_scope`, `0041_child_profiles` and `0042_child_plans`
  were applied with `psql`, each after a full database dump.
- **Master key created.** The master key for children's data lives on the server, readable by root
  only. The owner keeps an offline copy.
- **Baseline Tutor created.** It is inactive and private.
- **Curriculum key widened.** The curriculum gave freelee's key a scope, then widened it to units
  and year profiles.

---

## v2026.11.11 — Things that work again, and keys you can test

Updates #59–#64 · tag `v2026.11.11` → `3373956`

**In short**

- **Bot edits save again.** When something is wrong, the form says which field.
- **Shelves for many bots at once.** Many bots can get the same library shelves in one step. The
  business library went to 11 business bots this way.
- **Save → Test → Fetch for every key.** A key is saved, then tested with a real call, then
  fetched. Fetch brings in the provider's models by itself.
- **Bot teams are simpler.** One builder makes and edits a team, and runs follow the order you
  chose. Three runner bugs were fixed.
- **Docs caught up.** The README, handbook and doc index describe the new behaviour.

**Updates**

| # | Commit | What |
|---|---|---|
| #64 | `3373956` | Bring the README, handbook and doc index in line with today's updates |
| #63 | `40df192` | Bot teams get one simple builder, and run in the order you chose |
| #62 | `59da6c1` | Every key gets Save, then Test, then Fetch — and Fetch updates the models by itself |
| #61 | `dc8cbe0` | Type the grant script's rows, so the typecheck passes again |
| #60 | `3109e08` | Give many bots the same shelves in one step, starting with the business library |
| #59 | `9447bdd` | Bot edits save again, and say which field is wrong |

**Docs:** `11-persona-versioning.md`, `45-teamwork-and-projects.md`, `51-connection-checks.md`;
handbook *AI models*, *Settings*, *Bot teams*, *When something looks wrong*.

**Changed outside git**
- **Shelves granted.** Business library shelves were granted to 11 business bots with
  `scripts/grant-grounding.ts`, after a backup of the personas.
