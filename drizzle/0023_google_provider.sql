-- Google (Gemini) as a chat provider (2026-08-08). Additive: one provider row.
--
-- No models are seeded — they come from the live "Fetch models" button, the
-- same rule every other provider follows (docs/10-ai-model-registry.md).
-- Google's list endpoint states capabilities explicitly, so the fetch filters
-- on `generateContent` rather than guessing from the model id.

INSERT INTO "ai_providers" ("key", "label", "supports", "default_model", "api_key_env", "base_url_env", "fallback_base_url", "sort", "is_active")
VALUES ('google', 'Google (Gemini)', '["stream"]'::jsonb, 'gemini-2.5-flash', 'GOOGLE_API_KEY', NULL, NULL, 2, true)
ON CONFLICT ("key") DO NOTHING;
