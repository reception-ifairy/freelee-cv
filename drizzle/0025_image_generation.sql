-- Real image generation (2026-08-09). Additive: one column.
--
-- Images are billed per picture, not per 1,000 tokens, so credits_per_1k
-- can't express their cost. Default 40 is a deliberate mid-range starting
-- point an admin is expected to tune per model, not a claim about any
-- provider's real price. Ignored for text models.
-- See docs/26-vision-and-images.md.

ALTER TABLE "ai_models" ADD COLUMN "credits_per_image" integer DEFAULT 40 NOT NULL;
