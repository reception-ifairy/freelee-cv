-- Replaces the hardcoded curriculum/universe grounding sources
-- (src/lib/knowledge/registry.ts) with an admin-manageable registry — same
-- pattern as ai_providers/ai_models (Phase 3), generalized where the
-- response shape allows it (dot-path spec, not a bespoke parser per
-- source). Purely additive: one new table. See docs/18-knowledge-sources.md.

CREATE TABLE "knowledge_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text NOT NULL,
	"path" text DEFAULT '/v1/search' NOT NULL,
	"api_key" text,
	"grant" text,
	"results_path" text DEFAULT 'data.results' NOT NULL,
	"title_path" text DEFAULT 'title' NOT NULL,
	"text_path" text DEFAULT 'text' NOT NULL,
	"citation_path" text DEFAULT 'sourceUrl' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "knowledge_sources_key_idx" ON "knowledge_sources" USING btree ("key");
