-- Phase 9 (optional, last) of the teams/marketplace-concept integration:
-- external vendor marketplace. Additive only: one new enum value on an
-- existing type, one new nullable column on persona_versions, five new
-- tables. Nothing existing is read differently by any code that predates
-- this migration. See docs/16-marketplace.md.

ALTER TYPE "public"."entitlement_source_type" ADD VALUE 'marketplace';--> statement-breakpoint

ALTER TABLE "persona_versions" ADD COLUMN "authored_by_team_id" text;--> statement-breakpoint

CREATE TYPE "public"."listing_pricing_model" AS ENUM('free', 'one_off', 'subscription', 'credit_markup');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint

CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"payout_email" text,
	"stripe_connect_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"persona_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"pricing_model" "listing_pricing_model" DEFAULT 'free' NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"credit_markup_pct" real,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"moderator_note" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"install_count" integer DEFAULT 0 NOT NULL,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "listing_installs" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"installing_team_id" text NOT NULL,
	"installed_persona_id" integer NOT NULL,
	"entitlement_id" integer,
	"credit_markup_pct_snapshot" real,
	"installed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "listing_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"installing_team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_credits_charged" bigint DEFAULT 0 NOT NULL,
	"net_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "vendors_team_idx" ON "vendors" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_slug_idx" ON "vendors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_vendor_persona_idx" ON "listings" USING btree ("vendor_id","persona_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_installs_unique_idx" ON "listing_installs" USING btree ("listing_id","installing_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_reviews_unique_idx" ON "listing_reviews" USING btree ("listing_id","installing_team_id");--> statement-breakpoint
CREATE INDEX "payouts_vendor_idx" ON "payouts" USING btree ("vendor_id","period_start");--> statement-breakpoint

ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_authored_by_team_id_teams_id_fk" FOREIGN KEY ("authored_by_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_installs" ADD CONSTRAINT "listing_installs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_installs" ADD CONSTRAINT "listing_installs_installing_team_id_teams_id_fk" FOREIGN KEY ("installing_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_installs" ADD CONSTRAINT "listing_installs_installed_persona_id_personas_id_fk" FOREIGN KEY ("installed_persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_installs" ADD CONSTRAINT "listing_installs_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_installs" ADD CONSTRAINT "listing_installs_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_installing_team_id_teams_id_fk" FOREIGN KEY ("installing_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
