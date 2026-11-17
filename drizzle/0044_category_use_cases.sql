-- The B2C foundation of every field (owner decision 2026-11-17: "start with
-- the B2C design in every category as the foundation"; freelee #98).
--
-- Today 19 of the 20 fields link no consumer group at all, although their
-- sectors are scored as well suited to consumers, and none of the 87 live bots
-- is for one. This table holds a field's everyday uses: a concrete situation a
-- member of the public is in, what they would type first, which B2C groups it
-- is for, and whether it helps someone with little money. The category agent
-- designs them (proposal kind `b2c_design`); the owner approves.
--
-- `segment_codes` has no foreign key, like category_audience_segments: the
-- catalogue is src/lib/persona/audience-segments.ts. `persona_id` is the bot
-- that serves the use, once one is approved.
--
-- Additive only, safe to re-run. Applied with psql like every file here.
CREATE TABLE IF NOT EXISTS "category_use_cases" (
  "id" serial PRIMARY KEY,
  "category_id" integer NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  "sector_id" integer REFERENCES "sectors"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "situation" text NOT NULL,
  "first_message" text,
  "segment_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "budget_friendly" boolean NOT NULL DEFAULT false,
  "persona_id" integer REFERENCES "personas"("id") ON DELETE SET NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "category_use_cases_category_idx" ON "category_use_cases" ("category_id", "position");
