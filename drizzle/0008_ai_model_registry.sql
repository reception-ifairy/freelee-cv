-- Phase 3 of the teams/marketplace-concept integration: DB-backed AI model
-- registry, replacing the static PROVIDERS const in src/lib/ai/registry.ts.
-- ai_model_team and provider_credentials are parked (no reader/writer yet) —
-- wired up in Phase 5. See docs/10-ai-model-registry.md.

CREATE TYPE "public"."ai_model_status" AS ENUM('preview', 'stable', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."credential_scope" AS ENUM('platform', 'team', 'user');--> statement-breakpoint

CREATE TABLE "ai_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"supports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_model" text NOT NULL,
	"api_key_env" text NOT NULL,
	"base_url_env" text,
	"fallback_base_url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE TABLE "ai_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"label" text NOT NULL,
	"tier" text,
	"credits_per_1k" integer NOT NULL,
	"status" "ai_model_status" DEFAULT 'stable' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "ai_model_team" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"ai_model_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"markup_pct" real,
	"daily_token_cap" integer
);
--> statement-breakpoint

CREATE TABLE "provider_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text,
	"user_id" text,
	"provider_id" integer NOT NULL,
	"scope" "credential_scope" DEFAULT 'team' NOT NULL,
	"label" text,
	"encrypted_key" text,
	"key_last4" text,
	"status" text DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "ai_providers_key_idx" ON "ai_providers" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_model_idx" ON "ai_models" USING btree ("provider_id","model_id");--> statement-breakpoint
CREATE INDEX "ai_models_status_idx" ON "ai_models" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_team_idx" ON "ai_model_team" USING btree ("team_id","ai_model_id");--> statement-breakpoint
CREATE INDEX "provider_credentials_team_idx" ON "provider_credentials" USING btree ("team_id");--> statement-breakpoint

ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_team" ADD CONSTRAINT "ai_model_team_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_team" ADD CONSTRAINT "ai_model_team_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;
