-- Adult accounts with child profiles (owner decisions 2026-11-12, docs/54-children-data.md).
--
-- freelee is for adults. A parent or guardian holds the account; a child is a
-- profile under it, never a login of its own. Everything about a child that
-- could identify or describe them is encrypted by the application before it
-- reaches this database (src/lib/crypto/envelope.ts): `data` holds the sealed
-- profile (pseudonym, year, subjects, pathway, interests, adaptations) and
-- `wrapped_key` the child's own data key, wrapped by the master key kept in a
-- root-only file outside the database. Deleting the row deletes the key, so
-- the child's encrypted plan and chats become unreadable with it.
--
-- Plain columns are only what the server needs without decrypting: who owns
-- the profile, its state, and dates for the retention job (inactive profiles
-- are deleted after 12 months, with an email to the parent a month before).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adult_declared_at" timestamptz;

CREATE TABLE IF NOT EXISTS "child_profiles" (
  "id" text PRIMARY KEY,
  "parent_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'paused')),
  "key_version" integer NOT NULL,
  "wrapped_key" bytea NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "last_active_at" timestamptz NOT NULL DEFAULT now(),
  "retention_notice_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "child_profiles_parent_idx" ON "child_profiles" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "child_profiles_active_idx" ON "child_profiles" ("last_active_at");

-- What a parent agreed to and when: one row per consent, withdrawn_at set when
-- taken back. Ids, a kind and the version of the text shown — nothing else.
CREATE TABLE IF NOT EXISTS "consents" (
  "id" bigserial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "child_profile_id" text REFERENCES "child_profiles"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "text_version" text NOT NULL,
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "consents_user_idx" ON "consents" ("user_id");
