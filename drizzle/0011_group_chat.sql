-- Phase 6 of the teams/marketplace-concept integration: group chat / rooms
-- module — the first `type: 'feature'` module (docs/08-module-architecture.md).
-- Purely additive: entirely new tables, parallel to (not migrating) the
-- existing chats/messages. See docs/13-group-chat.md.

CREATE TYPE "public"."conversation_kind" AS ENUM('room', 'crew_run', 'playground');--> statement-breakpoint
CREATE TYPE "public"."conversation_visibility" AS ENUM('private', 'team', 'link');--> statement-breakpoint
CREATE TYPE "public"."participant_type" AS ENUM('user', 'persona');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('owner', 'editor', 'commenter', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."conversation_message_author_type" AS ENUM('user', 'persona', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_message_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint

CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"kind" "conversation_kind" DEFAULT 'room' NOT NULL,
	"title" text,
	"created_by" text NOT NULL,
	"visibility" "conversation_visibility" DEFAULT 'team' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"token_total" integer DEFAULT 0 NOT NULL,
	"cost_total" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"participant_type" "participant_type" NOT NULL,
	"participant_id" text NOT NULL,
	"persona_version_id" integer,
	"role" "participant_role" DEFAULT 'editor' NOT NULL,
	"display_name" text,
	"mention_handle" text NOT NULL,
	"auto_respond" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	"muted_until" timestamp with time zone,
	"left_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"parent_id" text,
	"thread_root_id" text,
	"author_type" "conversation_message_author_type" NOT NULL,
	"author_id" text,
	"persona_version_id" integer,
	"content" text DEFAULT '' NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"ai_provider" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"status" "conversation_message_status" DEFAULT 'complete' NOT NULL,
	"error" text,
	"position" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "conversations_team_idx" ON "conversations" USING btree ("team_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_kind_idx" ON "conversations" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_identity_idx" ON "conversation_participants" USING btree ("conversation_id","participant_type","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_handle_idx" ON "conversation_participants" USING btree ("conversation_id","mention_handle");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "conversation_messages_thread_idx" ON "conversation_messages" USING btree ("thread_root_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_unique_idx" ON "message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_persona_version_id_persona_versions_id_fk" FOREIGN KEY ("persona_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_parent_id_conversation_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."conversation_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_thread_root_id_conversation_messages_id_fk" FOREIGN KEY ("thread_root_id") REFERENCES "public"."conversation_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_persona_version_id_persona_versions_id_fk" FOREIGN KEY ("persona_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_conversation_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
