-- Image-generation engines, catalog + admin config only (2026-08-08). Additive:
-- one new enum, one new nullable-safe column (default 'text', every existing
-- row unaffected — zero behavior change for chat), one new provider row.
-- Deliberately seeds zero image `ai_models` rows — model ids/pricing change
-- often and should come from the live "Fetch models" action, not be hand-typed
-- here. See docs/21-image-engines.md.

CREATE TYPE "public"."ai_model_modality" AS ENUM('text', 'image');--> statement-breakpoint

ALTER TABLE "ai_models" ADD COLUMN "modality" "ai_model_modality" NOT NULL DEFAULT 'text';--> statement-breakpoint

INSERT INTO "ai_providers" ("key", "label", "supports", "default_model", "api_key_env", "base_url_env", "fallback_base_url", "sort", "is_active")
VALUES ('stability', 'Stability AI', '["images"]'::jsonb, 'stable-image-core', 'STABILITY_API_KEY', NULL, 'https://api.stability.ai', 4, true);
