-- Projects: a named container for work.
--
-- "Folders" is the first entry in the Deferred column of docs/13-group-chat.md
-- — scoped out at the time and never revisited. Until now the only grouping
-- primitives were `teams` (the tenant) and `crews` (a grouping of personas,
-- not of work), so there was nowhere to put "everything we did for this
-- engagement".
--
-- Every FK below is nullable and SET NULL. Work created before this migration
-- keeps working with a NULL project, and deleting a project never deletes what
-- was done inside it — losing a month of conversations because somebody tidied
-- up a folder would be unforgivable.

DO $$ BEGIN
  CREATE TYPE "project_status" AS ENUM ('active', 'paused', 'done', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "projects" (
  "id"          text PRIMARY KEY,
  "team_id"     text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "slug"        text NOT NULL,
  "description" text,
  -- Same accent convention as personas and categories, so a project reads as
  -- part of the same system rather than a new kind of thing.
  "colour"      text,
  "status"      "project_status" NOT NULL DEFAULT 'active',
  -- NULL means no cap. Deliberately not NOT NULL DEFAULT 0: "no budget set"
  -- and "a budget of zero" are different intentions, and a default would make
  -- them indistinguishable forever.
  "budget_credits" integer,
  -- Denormalised for listing without a join. credit_transactions stays the
  -- source of truth; this is a cache, reconciled from the ledger.
  "credits_spent"  integer NOT NULL DEFAULT 0,
  "created_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
  "archived_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- Slug is unique per team, not globally: two teams may both have a "Website
-- refresh" and neither should have to care that the other exists.
CREATE UNIQUE INDEX IF NOT EXISTS "projects_team_slug_idx" ON "projects" ("team_id", "slug");
CREATE INDEX IF NOT EXISTS "projects_team_idx" ON "projects" ("team_id", "status");

ALTER TABLE "chats"         ADD COLUMN IF NOT EXISTS "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "crews"         ADD COLUMN IF NOT EXISTS "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL;

-- Partial: the overwhelming majority of rows have no project, and "show me
-- this project's work" is the only query that uses the column.
CREATE INDEX IF NOT EXISTS "chats_project_idx"         ON "chats" ("project_id")         WHERE "project_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "conversations_project_idx" ON "conversations" ("project_id") WHERE "project_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "crews_project_idx"         ON "crews" ("project_id")         WHERE "project_id" IS NOT NULL;
