-- Phase 7 of the teams/marketplace-concept integration: crews (bot-to-bot
-- orchestration) module. Purely additive — new tables only. A crew run is a
-- group-chat `conversations` row (kind='crew_run') with crew members added
-- as ordinary conversation_participants, so it reuses runPersonaTurn()
-- unmodified for every step. See docs/14-crews.md.

CREATE TYPE "public"."crew_mode" AS ENUM('sequential', 'parallel', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."crew_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'budget_exceeded', 'max_turns_reached');--> statement-breakpoint
CREATE TYPE "public"."crew_step_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint

CREATE TABLE "crews" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mode" "crew_mode" DEFAULT 'sequential' NOT NULL,
	"budget_credits" integer DEFAULT 50 NOT NULL,
	"max_turns" integer DEFAULT 6 NOT NULL,
	"stop_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "crew_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_id" text NOT NULL,
	"persona_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"instructions" text,
	"is_supervisor" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint

CREATE TABLE "crew_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"crew_id" text NOT NULL,
	"team_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"status" "crew_run_status" DEFAULT 'queued' NOT NULL,
	"input" text NOT NULL,
	"budget_credits" integer NOT NULL,
	"credits_spent" integer DEFAULT 0 NOT NULL,
	"max_turns" integer NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"stop_reason" text,
	"triggered_by" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "crew_run_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_run_id" text NOT NULL,
	"position" integer NOT NULL,
	"crew_member_id" integer,
	"persona_id" integer NOT NULL,
	"conversation_message_id" text,
	"status" "crew_step_status" DEFAULT 'running' NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "crews_team_idx" ON "crews" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "crew_members_crew_idx" ON "crew_members" USING btree ("crew_id","position");--> statement-breakpoint
CREATE INDEX "crew_runs_crew_idx" ON "crew_runs" USING btree ("crew_id","created_at");--> statement-breakpoint
CREATE INDEX "crew_runs_team_idx" ON "crew_runs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "crew_run_steps_run_idx" ON "crew_run_steps" USING btree ("crew_run_id","position");--> statement-breakpoint

ALTER TABLE "crews" ADD CONSTRAINT "crews_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_runs" ADD CONSTRAINT "crew_runs_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_runs" ADD CONSTRAINT "crew_runs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_runs" ADD CONSTRAINT "crew_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_runs" ADD CONSTRAINT "crew_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_run_steps" ADD CONSTRAINT "crew_run_steps_crew_run_id_crew_runs_id_fk" FOREIGN KEY ("crew_run_id") REFERENCES "public"."crew_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_run_steps" ADD CONSTRAINT "crew_run_steps_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_run_steps" ADD CONSTRAINT "crew_run_steps_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_run_steps" ADD CONSTRAINT "crew_run_steps_conversation_message_id_conversation_messages_id_fk" FOREIGN KEY ("conversation_message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE set null ON UPDATE no action;
