-- Teach the model registry that embedding models exist.
--
-- `ai_model_modality` has been ('text','image') since 0019, and
-- src/lib/ai/fetch-models.ts *deliberately* discards anything matching
-- text-embedding-* — a correct decision when nothing could consume one. The
-- Knowledgebase can, and the platform's standing rule is that models are DB
-- rows while providers are code, so an embedding model has to be a row like
-- any other rather than a constant in a file.
--
-- Alone in its own migration because ALTER TYPE ... ADD VALUE cannot have its
-- new value *used* in the same transaction. The row that uses it is 0036.
--
-- Both model pickers already filter on modality = 'text'
-- (src/app/admin/settings/page.tsx, src/components/admin/persona-form.tsx),
-- so an embedding row cannot leak into a persona's model choice.

ALTER TYPE "ai_model_modality" ADD VALUE IF NOT EXISTS 'embedding';
