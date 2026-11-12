-- One learning plan per child, shared by every tutor (owner decision 2026-11-12,
-- docs/54-children-data.md, docs/53-tutor-measurement.md).
--
-- The plan is built once from curriculum's POST /v1/plan-pack (year, subjects,
-- pathway — never personal data) and sealed with the child's own key like the
-- profile: units in order, the current unit per subject, progress and review
-- dates. curriculum_version stays plain so the app can tell, without
-- decrypting, that the programme changed and offer the parent a refresh.
--
-- chats.child_profile_id marks a lesson: its messages are sealed with the
-- child's key, its tutor reads the child's plan, and deleting the profile
-- deletes the chat. usage_events gains the model steps and tool calls of a
-- turn, so the cost of looking things up is visible per turn, not only in a
-- benchmark.

CREATE TABLE IF NOT EXISTS "child_plans" (
  "id" text PRIMARY KEY,
  "child_profile_id" text NOT NULL UNIQUE REFERENCES "child_profiles"("id") ON DELETE CASCADE,
  "curriculum_version" text NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "child_profile_id" text REFERENCES "child_profiles"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "chats_child_profile_idx" ON "chats" ("child_profile_id") WHERE "child_profile_id" IS NOT NULL;

ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "steps" integer;
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "tool_calls" integer;
