-- Tool calling (2026-08-09). Additive: one jsonb column defaulting to an
-- empty array, so every existing persona keeps exactly today's behaviour —
-- no tools, no tool-calling round trips, no change in cost.
-- See docs/29-tools.md.

ALTER TABLE "persona_versions" ADD COLUMN "tools" jsonb DEFAULT '[]'::jsonb NOT NULL;
