# 54 · Children's data — adult accounts, child profiles, encryption

**Status:** accounts, profiles, consents and encryption live since update #67 (2026-11-12). The
learning plan, child mode and encrypted chats follow in #68; the parent dashboard (export,
transcripts), retention job and the full DPIA in #69.

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
