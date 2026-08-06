CREATE TYPE "public"."risk_level" AS ENUM ('R0', 'R1', 'R2', 'R3');
CREATE TYPE "public"."narrative_fit" AS ENUM ('low', 'medium', 'high', 'very_high');

ALTER TABLE "categories" ADD COLUMN "uk_market_size" text;
ALTER TABLE "categories" ADD COLUMN "uk_growth_rate" text;
ALTER TABLE "categories" ADD COLUMN "uk_key_regulations" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "categories" ADD COLUMN "uk_industry_bodies" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "categories" ADD COLUMN "default_risk_level" "risk_level";
ALTER TABLE "categories" ADD COLUMN "narrative_potential" "narrative_fit";

CREATE TABLE "sectors" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_id" integer NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "b2c_suitability" integer DEFAULT 50 NOT NULL,
  "b2b_suitability" integer DEFAULT 50 NOT NULL,
  "b2g_suitability" integer DEFAULT 50 NOT NULL,
  "typical_risk_level" "risk_level",
  "narrative_fit" "narrative_fit",
  "primary_interaction_modes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "sectors" ADD CONSTRAINT "sectors_category_id_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "sectors_category_slug_idx" ON "sectors" ("category_id", "slug");
CREATE UNIQUE INDEX "sectors_code_idx" ON "sectors" ("code");
CREATE INDEX "sectors_category_idx" ON "sectors" ("category_id");
