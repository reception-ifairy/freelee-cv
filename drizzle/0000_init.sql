CREATE TYPE "public"."curriculum_level" AS ENUM('K1', 'K2', 'K3', 'K4', 'ADULT');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('purchase', 'bonus', 'spend', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."menu_location" AS ENUM('header', 'footer', 'legal');--> statement-breakpoint
CREATE TYPE "public"."menu_visibility" AS ENUM('all', 'guest', 'auth', 'admin');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('streaming', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."modifier_type" AS ENUM('tone', 'writing', 'output', 'length', 'audience');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."setting_type" AS ENUM('string', 'text', 'bool', 'int', 'float', 'json', 'secret');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text,
	"action" text NOT NULL,
	"description" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"persona_id" integer,
	"guest_token" text,
	"title" text,
	"model" text,
	"ai_provider" text,
	"modifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"messages_count" integer DEFAULT 0 NOT NULL,
	"credits_spent" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"order_id" text,
	"message_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_cents" integer NOT NULL,
	"compare_at_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"credits" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"badge" text,
	"tier" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"location" "menu_location" DEFAULT 'header' NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"visible_to" "menu_visibility" DEFAULT 'all' NOT NULL,
	"open_in_new_tab" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"model" text,
	"ai_provider" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"status" "message_status" DEFAULT 'complete' NOT NULL,
	"error" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" text NOT NULL,
	"pack_id" integer,
	"pack_name" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"gateway" text NOT NULL,
	"gateway_ref" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"credits_granted" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"noindex" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_categories" (
	"persona_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "persona_categories_persona_id_category_id_pk" PRIMARY KEY("persona_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"description" text,
	"expertise" text,
	"avatar" text,
	"accent_color" text DEFAULT '#6366f1' NOT NULL,
	"system_prompt" text NOT NULL,
	"welcome_message" text,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_provider" text DEFAULT 'openai' NOT NULL,
	"model" text,
	"temperature" real DEFAULT 0.8 NOT NULL,
	"top_p" real,
	"frequency_penalty" real DEFAULT 0 NOT NULL,
	"presence_penalty" real DEFAULT 0 NOT NULL,
	"max_tokens" integer,
	"history_messages" integer DEFAULT 8 NOT NULL,
	"curriculum_level" "curriculum_level",
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"knowledge_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credits_per_message" integer DEFAULT 0 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"chats_count" integer DEFAULT 0 NOT NULL,
	"messages_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" text,
	"category_id" integer,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text DEFAULT '' NOT NULL,
	"cover_image" text,
	"meta_title" text,
	"meta_description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"reading_minutes" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "modifier_type" NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"title" text,
	"description" text,
	"og_image" text,
	"noindex" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"group" text DEFAULT 'general' NOT NULL,
	"value" text,
	"type" "setting_type" DEFAULT 'string' NOT NULL,
	"label" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_css" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"image" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"lifetime_purchased" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_id_credit_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."credit_packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_categories" ADD CONSTRAINT "persona_categories_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_categories" ADD CONSTRAINT "persona_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_action_idx" ON "activity_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "chats_user_idx" ON "chats" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "chats_guest_idx" ON "chats" USING btree ("guest_token");--> statement-breakpoint
CREATE UNIQUE INDEX "chats_share_idx" ON "chats" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "ledger_user_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "packs_slug_idx" ON "credit_packs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "menu_location_idx" ON "menu_items" USING btree ("location","position");--> statement-breakpoint
CREATE INDEX "messages_chat_idx" ON "messages" USING btree ("chat_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "orders_gateway_ref_idx" ON "orders" USING btree ("gateway_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "personas_slug_idx" ON "personas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "personas_listing_idx" ON "personas" USING btree ("is_active","is_featured","position");--> statement-breakpoint
CREATE INDEX "personas_level_idx" ON "personas" USING btree ("curriculum_level");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "modifiers_type_name_idx" ON "prompt_modifiers" USING btree ("type","name");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_route_idx" ON "seo_settings" USING btree ("route");--> statement-breakpoint
CREATE INDEX "settings_group_idx" ON "settings" USING btree ("group","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "themes_slug_idx" ON "themes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active","created_at");