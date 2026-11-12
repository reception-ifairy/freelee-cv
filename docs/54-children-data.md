# 54 · Children's data — adult accounts, child profiles, encryption

**Status:**
- **#67 (2026-11-12):** accounts, profiles, consents and encryption.
- **#68:** the learning plan per child, child mode and encrypted lessons.
- **#69:** the parent dashboard (lessons, export), "Anything else?" used once, account deletion, the retention job and the DPIA below.

## Owner decisions (2026-11-12)

1. **Adults only.** A parent or guardian holds the account; a child is a profile under it, never a
   login of its own.
2. **The parent decides what to give, and every field says why.** Each field shows *why we ask*,
   *where it goes* and *how long we keep it* (`src/lib/children/profile.ts` `FIELD_NOTES`, rendered
   by the form).
3. **Encrypted, on our own server.** Application-level AES-256-GCM, a key per child.
4. **Adult check at launch:** a separate "I am 18 or over" declaration at sign-up plus a confirmed
   email address; a card check joins when payments go live.
5. **Parents see progress and full chats**; the child sees a standing notice that their grown-up can
   read them (#68/#69).
6. **UK English first**; the developmental levels already carry Polish examples.

## Sign-up

`registerAction` (`src/server/actions/auth.ts`):

- **Two checkboxes:** `adult` (new, required) and `terms`.
- **What it writes:** `users.adult_declared_at` and two rows in `consents` (`terms`,
  `adult_declaration`, with `text_version`).
- **Verification email:** a link to `/verify-email`, built by `src/lib/children/verify-email.ts`.
  - The token is hashed in Auth.js `verification_tokens` under `verify-email:<userId>` and is valid
    for 48 hours.
  - Until a Resend key and sender address are set (Admin → Settings → Email), the email is printed
    to the server log instead of being sent.
- **Older accounts** confirm the adult declaration once, on the Children page.

**Fixed on the way:** sign-up created the personal team without its credit wallet, so every
registration failed at the welcome bonus ("No credit wallet for team …", HTTP 500). Registration now
creates the wallet with the team, as `src/lib/billing/credits.ts` always assumed.

## Child profiles

- **Page:** `/dashboard/children` (account menu → Children).
- **Who can create one:** only a signed-in adult whose email is confirmed and who has made the adult
  declaration.
- **First save:** needs a separate consent box ("I am this child's parent or guardian …").

| Field | Required | Why we ask | Where it goes | Kept |
|---|---|---|---|---|
| Nickname | yes | how tutors address the child — not their real name | AI tutor, during lessons | until the profile is deleted |
| School year (Y1–Y11) | yes | the right curriculum and the right way to talk at that age | curriculum receives the year only | until deleted |
| Subjects | ≥ 1 | builds the plan | curriculum receives the subject names | until deleted |
| GCSE pathway (Y9+) | no | when GCSE starts, tier, science route; "not sure" allowed | curriculum receives these settings | until deleted |
| Focus | no | what to concentrate on | AI tutor | until changed or deleted |
| Interests (≤ 5) | no | familiar examples | AI tutor | until changed or deleted |
| Adaptations (checklist) | no | pace and form — practical instructions, never a diagnosis | AI tutor, as instructions | until changed or deleted |
| Include PSHE | no, off | adds PSHE topics; tutors never teach RSE | changes the topics in the plan | until switched off (consent withdrawn) |

**Never asked:** real name, date of birth, school, address, photos, location, diagnoses or health
details.

**Consent rows:**
- `child_profile` on creation;
- `pshe` when PSHE is switched on, with `withdrawn_at` set when it is switched off.

**Validation** (`src/lib/children/store.ts`):
- short plain text only (no control characters or markup);
- known subject and adaptation ids;
- the pathway is kept only from Year 9.

## Encryption (`src/lib/crypto/envelope.ts`)

- **Master key:** `/etc/freelee/keys/master-v1.key` — 32 random bytes, root-only (0400 in a 0700
  directory), outside the repository and the database. It is read once per process through
  `FREELEE_MASTER_KEY_FILE` in `.env.local`. It only wraps the per-child keys. **The owner keeps an
  offline copy.** If the file and its copy are lost, every child's data is unreadable — by design.
- **Data key per child:** 32 random bytes, stored wrapped in `child_profiles.wrapped_key`.
  - Associated data `dek:<profileId>`, so a wrapped key opens only for its own profile.
- **Values** use AES-256-GCM with a random 96-bit IV.
  - Associated data `child:<profileId>:<field>`, so a value moved to another row or field fails to
    open instead of being read as something else.
  - Format: `v1 | key version | iv | tag | ciphertext`.
  - As text, used for chat messages in #68: `enc:v1:<base64>`.
- **Database layout:** `child_profiles.data` is the sealed profile. The plain columns are only owner,
  status and dates, which the retention job needs.
- **Fail closed:** without the master key file, child features are off (`childFeaturesAvailable()`)
  and nothing is stored. The rest of the site works.
- **Not encrypted with the parent's password**, deliberately: tutors must read the plan while the
  child learns, without the parent typing anything.
- **Deletion = crypto-shredding.** Deleting a profile deletes its wrapped key, and the plan and chats
  are deleted with it by cascade. Database backups taken earlier still hold the wrapped key until
  they expire; the backup retention period is the limit.
- **Rotation:** `scripts/rotate-master-key.ts --from=… --to=…` (a dry run unless `--apply`) re-wraps
  every child key under a new `master-vN.key`. The data itself is not re-encrypted.
- **Check:** `npm run children:verify-envelope` (also part of `blocks:verify`), 14 checks. It covers:
  - fail closed without a key;
  - round trip;
  - no plain text in the sealed bytes;
  - a random IV;
  - tamper detection;
  - wrong field or wrong child refused;
  - rotation;
  - a clear message for a key from another version.

## The learning plan (#68, `src/lib/children/plan.ts`)

**How a plan is built**
- **One plan per child, shared by every tutor.** It is built once, when the parent saves the profile
  (or with **Build plan / Refresh plan**), from curriculum's `POST /v1/plan-pack`.
- **What the curriculum receives:** only the year, the subjects, the GCSE settings and the PSHE
  opt-in.
- **Storage:** sealed with the child's key in `child_plans.data`.
- **What the plan holds:** units in order per subject, the current unit, progress per objective code
  and unit id, review dates, the developmental level profile and, from Year 9, the study strategy.
  `curriculum_version` stays plain so a programme update can be noticed without decrypting.
- **Refresh:** keeps progress (it is keyed by code) and the current unit while that unit still
  exists.
- **When the curriculum cannot answer:** the profile is saved anyway. The plan is built later, on
  the button or at the first lesson. Until then a lesson runs without a plan.

**Progress**
- The tutor ends a reply with `[PROGRESS: CODE learning|secure]`. The tag is never shown: it is
  stripped in `parseSuggestions` for display (even mid-stream) and removed before the reply is
  stored.
- `applyProgress` records it. Only codes that are in the plan count.
- A secure item comes back for review after 1, 3, 7 and 21 days. A subject moves on when its
  current unit (or all its objectives) is secure.

## Child mode and lessons (#68)

**Entering and leaving**
- **Start learning as <nickname>** on the Children page sets a signed cookie `freelee_child`. The
  signature is an HMAC over parent id and profile id with `AUTH_SECRET`, so the cookie cannot be
  moved to another account and says nothing about the child.
- While the cookie is set, only `/learn` and the child's own lessons open. `src/lib/auth.config.ts`
  sends everything else back to `/learn`, and the chat page refuses another child's chat.
- **Leaving** (`/learn/exit`) needs the parent's password.

**What the child sees**
- `/learn` shows the child's current units and the tutors for their key stage (personas whose
  curriculum scope covers it; the inactive Baseline Tutor only for a platform admin).
- A standing notice: "Your grown-up can read our chats. Tutors are computer programs (AI), not
  people."

**A lesson** is a chat with `chats.child_profile_id`:
- **Encryption:** the child's messages and the tutor's replies are sealed with the child's key
  (`enc:v1:`). They are opened only for the parent who owns the profile (the chat page, and `GET
  /api/chat`).
- **Title:** generic ("Lesson with …") instead of the child's first words.
- **Never shared.** Deleting the profile deletes its lessons.

**The prompt**, in this order:
1. the tutor's own prompt (voice and world);
2. "Teaching from the curriculum" in plan mode: teach from the plan, look up only what it does not
   cover, at most once;
3. **Your learner** — `learnerSection`:
   - nickname, interests, focus and adaptations;
   - how to talk at this age, from the level profile;
   - the plan slice for the tutor's subjects: the current unit, up to 10 objectives with their
     state, the next unit and reviews due;
   - how to record progress.

**Tools and steps**
- At most one curriculum look-up per turn. A second call is answered locally: "teach from the
  plan".
- Two model steps.

**For every chat, not only lessons**
- On the last allowed step the model may not call a tool (`prepareStep` → `toolChoice: 'none'`), so
  a turn always ends in an answer. The first "before" measurement (docs/53) had two turns end
  empty.
- `usage_events.steps` and `tool_calls` record what each turn spent on look-ups.

## Tutors for children: no guests

`POST /api/chat` answers 403 to a guest talking to a persona with a curriculum scope. Children learn
through a parent's account. #68 adds child mode, the per-child plan and encrypted chats.

## Verified live (2026-11-12)

- Migration `0041_child_profiles.sql` was applied after a full `pg_dump`
  (`/root/backups/freelee/pre-0041-full-*.dump`).
- **Browser test:**
  1. sign-up with both boxes: account created with 250 welcome credits;
  2. Children asks to confirm the email;
  3. the link from the server log gives "Email confirmed";
  4. a profile is created, with all 7 field notes shown;
  5. delete removes it.
- **Database check:** the nickname and interests do not appear in `child_profiles` or in a
  `pg_dump` of it.
- **Consents:** `terms`, `adult_declaration` and `child_profile` were recorded.
- Test accounts were removed afterwards.

### Lessons (#68), verified live 2026-11-12

- Migration `0042_child_plans.sql` was applied after a full `pg_dump` (`pre-0042-full-*.dump`).
- **Browser test**, on a test account:
  1. sign-up, email confirmed, a Y4 profile created. The plan was "could not be built just now",
     because curriculum's plan pack was not deployed yet (that case is handled).
  2. **Start learning** → `/learn` with the notice and 1 tutor.
  3. `/dashboard` → sent back to `/learn`.
  4. A lesson with Pan Kleks: one turn of 2 steps, 1 look-up, 152 credits. The reply was complete
     and no progress tag was visible.
  5. In the database the child's message and the reply are `enc:v1:…` and the title is "Lesson with
     Pan Kleks".
  6. `/learn/exit` with the parent's password → Children page.
- The test account and its data were removed afterwards.

## Parent dashboard, retention, deletion (#69)

- **Lessons.** The Children page lists each child's lessons, newest first, with the tutor, the date
  and the message count. A parent opens the full transcript; it is decrypted for them only. The
  child sees a standing notice that this is possible (owner decision).
- **Export.** "Download everything about <nickname>" calls `/dashboard/children/:id/export`. The JSON
  holds the profile, the plan with progress, every lesson in clear and the consents. It is decrypted
  only for the profile's own parent.
- **"Anything else?"** — free text, used once (`src/lib/children/notes.ts`):
  - It needs its own consent box, because a parent may describe health.
  - One call to the provider's *fast* model maps the text onto the adaptation checklist.
  - The text is then dropped: never stored, never logged, never shown to a tutor.
  - Only the chosen adaptation ids join the sealed profile. A `notes_once` consent row records that
    it happened.
- **Retention** (`src/lib/children/retention.ts`): a daily job `children.retention` in the existing
  queue. It is scheduled when the worker starts and re-queues itself.
  - Lessons are deleted 90 days after their last message.
  - A profile unused for 11 months triggers an email to the parent. After 12 months, and at least
    25 days after that email, the profile is deleted, which crypto-shreds its plan and lessons.
  - The log carries counts only. `npm run children:retention [-- --now=YYYY-MM-DD]` shows what it
    would do, as a dry run.
- **Delete my account** (Profile page, password and a confirmation box) removes:
  - every child profile, with its key, plan and lessons;
  - all chats and consents;
  - the name, email, password and image.

  Payment records stay without personal details, because the law requires them. Platform admin
  accounts cannot be deleted there.

## DPIA (data protection impact assessment) — draft for the owner

**Why one is needed.** freelee processes data about children, profiles their learning for a
personalised plan, and uses AI. Under the ICO Children's Code (standard 2) a DPIA is expected before
launch. This draft is the engineering view. The owner signs it off and keeps it updated.

**Controller:** iFairy / freelee.cv (owner). **Processors:**
- the AI provider for tutor replies — OpenAI by default, through the API, where data is not used for
  training; retention follows the provider's API terms;
- curriculum.ifairy.co.uk, run by the same owner;
- the email service (Resend) once it is configured.

**Data map**

| Data | Purpose | Lawful basis | Where | Who sees it | Kept |
|---|---|---|---|---|---|
| Parent name, email, password hash | the account | contract | Postgres (password bcrypt) | the parent; the platform admin | until account deletion |
| 18+ declaration, consents | proof of who agreed to what | legal obligation / consent | `users`, `consents` | the platform admin | with the account |
| Child nickname, year, subjects, pathway, focus, interests, adaptations | plan and lessons | consent of the parent | `child_profiles.data`, sealed | the parent; the tutor (AI) during lessons | until deletion, or 12 months unused |
| Learning plan and progress | teaching in order | consent | `child_plans.data`, sealed | the parent; the tutor (slice) | as the profile |
| Lesson messages | the lesson itself; parent oversight | consent | `messages.content`, sealed | the parent | 90 days after the last message |
| "Anything else?" text | choosing adaptations | explicit consent (may be health) | memory only, one AI call | nobody (not stored) | not kept |
| Year, subjects, pathway | building the plan | consent | sent to curriculum | curriculum, which logs item ids only | curriculum `served_log`, 90 days |

**Risks and measures**

| Risk | Measures |
|---|---|
| Database copy leaks children's data | application encryption with a key per child; master key outside the database and repo; no plain text in the tables or in dumps (verified) |
| A child is identified | nickname only; no real name, date of birth, school, address, photos, location or diagnoses; curriculum never receives anything identifying |
| A child uses the service unsupervised as an account holder | adults-only accounts; 18+ declaration and confirmed email; child mode with the parent's password to leave |
| Over-collection or over-retention | annotated, mostly optional fields; free text used once and dropped; 90-day lessons; 12-month inactive profiles; deletion and export on demand |
| Unsuitable content | tutors for children are curriculum-scoped; no guests; level norms (never "wrong", never "it's easy"…); RSE not taught by AI; PSHE opt-in; the measurement bench checks replies |
| Hidden monitoring | standing notice to the child that the grown-up can read the chats |
| Loss of the master key | offline copy kept by the owner; rotation script |
| AI provider retention | API use only; the provider named in the privacy notice; option of a zero-retention agreement later |

**Children's Code — the 15 standards, where we stand**

| # | Standard | Where we stand |
|---|---|---|
| 1 | Best interests | plan and level norms built around the child |
| 2 | DPIA | this draft |
| 3 | Age-appropriate application | levels 0–5; adult accounts only |
| 4 | Transparency | field notes; child notice |
| 5 | Detrimental use | no ads, no nudges, no streak pressure |
| 6 | Policies and community standards | **to do:** child-friendly terms page |
| 7 | Default settings | PSHE off, sharing impossible for lessons |
| 8 | Data minimisation | annotated optional fields, free text not kept |
| 9 | Data sharing | curriculum receives settings only |
| 10 | Geolocation | none |
| 11 | Parental controls | full transcripts with a visible notice |
| 12 | Profiling | only the learning plan, which is the service itself; off otherwise |
| 13 | Nudge techniques | none |
| 14 | Connected toys | n/a |
| 15 | Online tools | export, delete profile, delete account, withdraw consent |

**Open items for the owner**
- A plain-language privacy notice for parents and a child-friendly version.
- The Resend key, so confirmation and retention emails are sent.
- Naming the AI provider in the notice.
- Deciding whether to ask the provider for zero data retention.

