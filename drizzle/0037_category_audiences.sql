-- Categories gain an audience.
--
-- `src/lib/persona/audience-segments.ts` holds 70 curated segments — 26 B2C,
-- 23 B2B, 21 B2G — each carrying `keyNeeds`, `preferredTone`,
-- `riskSensitivity`, UK context and, for the B2C ones, an age range. Two
-- things read that catalogue today: a checkbox list in the persona form
-- (which renders the code and the name, and none of the payload), and one
-- `startsWith('B2C-CYP-')` test in the layout chooser. Everything else in it
-- is written into source and read by nothing.
--
-- The structural reason is the same one sectors had before 0033: **no entity
-- pointed at a segment**, so the data had no way to reach anything. A persona
-- could tag itself with codes, but nothing connected a *field* to the people
-- who work in it. This is that edge.
--
-- Not a foreign key, deliberately. The catalogue is a TypeScript file, not a
-- table, so `segment_code` is validated in the server action against
-- `isAudienceSegmentCode` — exactly how `persona_versions.audience_segments`
-- already works. Making it a table would mean two sources of truth for the
-- same 70 rows, and the TypeScript one is where the payload lives.
--
-- Which segments belong to which category is editorial judgement, not
-- arithmetic: it cannot be derived from the sector suitability scores, because
-- "this field sells well to business" does not tell you *which* businesses.
--
-- The starting set lives in 0039, not here, and that ordering was found by
-- testing rather than reasoning: restoring into an empty database showed the
-- seed inserting nothing, because it matches on category slug and 0038 — which
-- creates the categories — had not run yet. DDL here, data after the data.

CREATE TABLE IF NOT EXISTS "category_audience_segments" (
  "category_id"  integer NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  -- A code from AUDIENCE_SEGMENTS, e.g. 'B2B-SEC-05'. Validated in the action.
  "segment_code" text NOT NULL,
  -- Why this audience matters to this field, in the operator's own words.
  -- Shown on the category page and compiled into the brief a bot is designed
  -- against, so it is content rather than a comment.
  "note"         text,
  "position"     integer NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("category_id", "segment_code")
);

CREATE INDEX IF NOT EXISTS "category_audience_segments_code_idx"
  ON "category_audience_segments" ("segment_code");
