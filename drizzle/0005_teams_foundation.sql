-- Phase 1 (teams retrofit), step 1 of 2: additive only.
-- Creates the teams/team_members/team_invitations tables and adds every
-- team_id/visibility/default_team_id column as NULLABLE. No NOT NULL, no FK
-- enforcement gaps introduced yet, no application code reads these columns
-- until after the backfill (see docs/06-operations.md backfill pattern) and
-- 0006_teams_not_null.sql have both run.

CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'member', 'guest');--> statement-breakpoint
CREATE TYPE "public"."team_ai_mode" AS ENUM('platform', 'byok', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."persona_visibility" AS ENUM('private', 'team', 'unlisted', 'public');--> statement-breakpoint

CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"plan_key" text DEFAULT 'free' NOT NULL,
	"ai_mode" "team_ai_mode" DEFAULT 'platform' NOT NULL,
	"seats_limit" integer DEFAULT 1 NOT NULL,
	"monthly_credit_grant" integer DEFAULT 0 NOT NULL,
	"data_retention_days" integer,
	"zero_retention" boolean DEFAULT false NOT NULL,
	"country" text DEFAULT 'GB' NOT NULL,
	"vat_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_credit_cap" integer,
	"model_allowlist" jsonb,
	"invited_by" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "team_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "teams_owner_idx" ON "teams" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_idx" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_token_idx" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invitations_team_idx" ON "team_invitations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invitations_email_idx" ON "team_invitations" USING btree ("email");--> statement-breakpoint

ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Nullable additions to existing live tables. NOT NULL is added later, in
-- 0006_teams_not_null.sql, only after the backfill assertion has passed.
ALTER TABLE "users" ADD COLUMN "default_team_id" text;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "visibility" "persona_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "team_id" text;--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_default_team_id_teams_id_fk" FOREIGN KEY ("default_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "personas_team_idx" ON "personas" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "chats_team_idx" ON "chats" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "orders_team_idx" ON "orders" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_team_idx" ON "credit_ledger" USING btree ("team_id");
