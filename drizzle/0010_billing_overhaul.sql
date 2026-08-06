-- Phase 5 of the teams/marketplace-concept integration: billing overhaul.
-- Adds subscriptions (any interval), time-boxed passes, entitlements,
-- team-scoped wallets/transactions, and raw usage events. Purely additive —
-- new tables, new nullable/defaulted columns on orders/personas, nothing
-- existing altered destructively. See docs/12-billing-overhaul.md.

CREATE TYPE "public"."plan_interval" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."pass_duration_unit" AS ENUM('hour', 'day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source_type" AS ENUM('subscription', 'pass', 'purchase', 'grant', 'trial');--> statement-breakpoint
CREATE TYPE "public"."entitlement_target_type" AS ENUM('platform', 'persona', 'module', 'model', 'feature');--> statement-breakpoint
CREATE TYPE "public"."wallet_owner_type" AS ENUM('team', 'user');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'bonus', 'spend', 'refund', 'adjustment', 'subscription_grant', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('credit_pack', 'subscription', 'pass');--> statement-breakpoint

CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"interval_unit" "plan_interval" NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"credits_per_cycle" integer DEFAULT 0 NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "pass_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_unit" "pass_duration_unit" NOT NULL,
	"duration_value" integer DEFAULT 1 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "plans_key_idx" ON "plans" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "pass_products_key_idx" ON "pass_products" USING btree ("key");--> statement-breakpoint

ALTER TABLE "orders" ADD COLUMN "kind" "order_kind" DEFAULT 'credit_pack' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "plan_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pass_product_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "credits" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pass_product_id_pass_products_id_fk" FOREIGN KEY ("pass_product_id") REFERENCES "public"."pass_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"plan_id" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"gateway" text DEFAULT 'stripe' NOT NULL,
	"gateway_customer_id" text,
	"gateway_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "subscriptions_team_idx" ON "subscriptions" USING btree ("team_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_gateway_sub_idx" ON "subscriptions" USING btree ("gateway_subscription_id");--> statement-breakpoint

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "credit_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_type" "wallet_owner_type" DEFAULT 'team' NOT NULL,
	"owner_id" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	"lifetime_granted" bigint DEFAULT 0 NOT NULL,
	"lifetime_spent" bigint DEFAULT 0 NOT NULL,
	"low_balance_threshold" integer,
	"auto_topup_enabled" boolean DEFAULT false NOT NULL,
	"auto_topup_amount" integer,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "credit_wallets_owner_idx" ON "credit_wallets" USING btree ("owner_type","owner_id");--> statement-breakpoint

CREATE TABLE "credit_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"wallet_id" integer NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text,
	"type" "credit_transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"idempotency_key" text,
	"description" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "credit_transactions_wallet_idx" ON "credit_transactions" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_team_idx" ON "credit_transactions" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transactions_idempotency_idx" ON "credit_transactions" USING btree ("idempotency_key");--> statement-breakpoint

ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_wallet_id_credit_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."credit_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text,
	"source_type" "entitlement_source_type" NOT NULL,
	"source_id" text,
	"target_type" "entitlement_target_type" NOT NULL,
	"target_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "entitlements_team_target_idx" ON "entitlements" USING btree ("team_id","target_type","expires_at");--> statement-breakpoint

ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "usage_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"team_id" text NOT NULL,
	"user_id" text,
	"persona_id" integer,
	"persona_version_id" integer,
	"chat_id" text,
	"message_id" text,
	"ai_provider_key" text NOT NULL,
	"ai_model_id" integer,
	"operation" text DEFAULT 'chat' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real,
	"credits_charged" bigint DEFAULT 0 NOT NULL,
	"covered_by_pass" boolean DEFAULT false NOT NULL,
	"is_byok" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "usage_events_team_idx" ON "usage_events" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_model_idx" ON "usage_events" USING btree ("ai_model_id");--> statement-breakpoint

ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_persona_version_id_persona_versions_id_fk" FOREIGN KEY ("persona_version_id") REFERENCES "public"."persona_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "usage_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text,
	"ai_model_id" integer,
	"tokens_in" bigint DEFAULT 0 NOT NULL,
	"tokens_out" bigint DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"credits" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "usage_daily_unique_idx" ON "usage_daily" USING btree ("date","team_id","user_id","ai_model_id");--> statement-breakpoint

ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "personas" ADD COLUMN "min_plan_tier" integer;
