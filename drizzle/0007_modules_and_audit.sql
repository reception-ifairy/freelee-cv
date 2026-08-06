-- Phase 2 of the teams/marketplace-concept integration: modules/moduleTeam
-- tables (DB-backed mirror of src/lib/modules/registry.ts) and activity_log
-- extended for team-scoped audit events. See docs/09-team-authorization.md.

CREATE TYPE "public"."module_type" AS ENUM('core', 'feature', 'admin', 'integration');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('installed', 'disabled', 'blocked');--> statement-breakpoint

CREATE TABLE "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "module_type" NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"requires" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"navigation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "module_status" DEFAULT 'installed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "module_team" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"team_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enabled_by" text
);
--> statement-breakpoint

CREATE UNIQUE INDEX "modules_key_idx" ON "modules" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "module_team_module_team_idx" ON "module_team" USING btree ("module_id","team_id");--> statement-breakpoint
CREATE INDEX "module_team_team_idx" ON "module_team" USING btree ("team_id");--> statement-breakpoint

ALTER TABLE "module_team" ADD CONSTRAINT "module_team_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_team" ADD CONSTRAINT "module_team_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_team" ADD CONSTRAINT "module_team_enabled_by_users_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "activity_log" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "old_values" jsonb;--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "new_values" jsonb;--> statement-breakpoint

ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_team_idx" ON "activity_log" USING btree ("team_id","created_at");
