-- Phase 4 of the teams/marketplace-concept integration: persona versioning.
-- Additive only: new persona_versions table, nullable pointer columns on
-- personas, nullable persona_version_id on chats. personas.system_prompt's
-- NOT NULL is relaxed here (new code writes content to persona_versions
-- instead) — see docs/11-persona-versioning.md for why currentVersionId
-- stays nullable forever (serial PKs, not deferrable uuids like Phase 1's
-- teams<->users pair) rather than following the usual backfill-then-NOT-NULL
-- two-step.

CREATE TYPE "public"."persona_version_status" AS ENUM('draft', 'published', 'deprecated');--> statement-breakpoint

-- Corrective addition (found 2026-08-06 via a from-scratch install dry run,
-- see the "Reset checkpoint" addendum in the session plan / docs/16-marketplace.md).
-- Six personas columns (audience_type, blueprint, interaction_style,
-- approach_to_unknown, prompt_technique, thinking_mode — the "Personat.AI
-- blueprint engine" cognitive knobs, src/lib/persona/prompt.ts) and the four
-- enum types four of them need were created directly against production by
-- hand, predating this phase's migration trail, and never made it into any
-- migration file — persona_versions below silently depended on all four
-- types already existing. Production already has all of this; it only
-- matters for a genuinely fresh install, which is exactly what caught it.
CREATE TYPE "public"."audience_type" AS ENUM('B2B', 'B2C', 'B2G');--> statement-breakpoint
CREATE TYPE "public"."interaction_style" AS ENUM('formal', 'casual', 'enthusiastic', 'concise', 'socratic');--> statement-breakpoint
CREATE TYPE "public"."approach_to_unknown" AS ENUM('admit_ignorance', 'educated_guess', 'ask_clarifying');--> statement-breakpoint
CREATE TYPE "public"."prompt_technique" AS ENUM('direct', 'chain_of_thought');--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "audience_type" "audience_type";--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "blueprint" jsonb;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "interaction_style" "interaction_style";--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "approach_to_unknown" "approach_to_unknown";--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "prompt_technique" "prompt_technique" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "thinking_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "personas_audience_idx" ON "personas" USING btree ("audience_type");--> statement-breakpoint

CREATE TABLE "persona_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"version" text NOT NULL,
	"changelog" text,
	"status" "persona_version_status" DEFAULT 'published' NOT NULL,
	"is_immutable" boolean DEFAULT false NOT NULL,
	"system_prompt" text NOT NULL,
	"welcome_message" text,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_provider" text DEFAULT 'openai' NOT NULL,
	"model" text,
	"model_tier" text,
	"temperature" real DEFAULT 0.8 NOT NULL,
	"top_p" real,
	"frequency_penalty" real DEFAULT 0 NOT NULL,
	"presence_penalty" real DEFAULT 0 NOT NULL,
	"max_tokens" integer,
	"history_messages" integer DEFAULT 8 NOT NULL,
	"audience_type" "audience_type",
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"knowledge_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grounding_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guardrails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience_segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blueprint" jsonb,
	"interaction_style" "interaction_style",
	"approach_to_unknown" "approach_to_unknown",
	"prompt_technique" "prompt_technique" DEFAULT 'direct' NOT NULL,
	"thinking_mode" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "persona_versions_persona_version_idx" ON "persona_versions" USING btree ("persona_id","version");--> statement-breakpoint
CREATE INDEX "persona_versions_persona_idx" ON "persona_versions" USING btree ("persona_id");--> statement-breakpoint

ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "personas" ADD COLUMN "current_version_id" integer;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "draft_version_id" integer;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "pin_versioning" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "system_prompt" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "personas" ADD CONSTRAINT "personas_current_version_id_persona_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_draft_version_id_persona_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "chats" ADD COLUMN "persona_version_id" integer;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_persona_version_id_persona_versions_id_fk" FOREIGN KEY ("persona_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;
