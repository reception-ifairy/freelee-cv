-- The first embedding model: OpenAI text-embedding-3-small.
--
-- 1536 dimensions, which is not an arbitrary choice: pgvector 0.6.0 — the
-- newest packaged for Ubuntu 24.04 — indexes at most 2,000 dimensions, so
-- text-embedding-3-large's 3072 could never be indexed on this server even
-- if the 6.5x price were worth it.
--
-- credits_per_1k is 0, and that is deliberate rather than an oversight. The
-- column is an integer and this model costs $0.02 per *million* tokens, so
-- any honest per-1k credit figure rounds to zero. Ingest is not billed to a
-- team at all (usage_events.team_id is NOT NULL and a platform-wide backfill
-- has no team) — real token counts are recorded on
-- library_documents.ingest_tokens instead, and the per-query embedding is
-- folded into the chat turn's own usage. Left at the creditsPer1k() fallback
-- of 5 it would have overcharged by roughly five orders of magnitude.

INSERT INTO "ai_models" ("provider_id", "model_id", "label", "tier", "credits_per_1k", "status", "modality", "sort")
SELECT p."id", 'text-embedding-3-small', 'Embeddings — small (1536d)', NULL, 0, 'stable', 'embedding', 100
FROM "ai_providers" p
WHERE p."key" = 'openai'
ON CONFLICT ("provider_id", "model_id") DO UPDATE
  SET "modality" = 'embedding',
      "credits_per_1k" = 0,
      "label" = EXCLUDED."label",
      "updated_at" = now();
