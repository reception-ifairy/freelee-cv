-- Frontpage section editor + branding columns (2026-08-07). Additive only:
-- four new nullable columns on themes, one new table, seeded with the home
-- page's current 7 sections in their current order/visibility/content so
-- nothing changes on the live site until an admin actually edits something
-- in /admin/frontpage. See docs/19-frontpage-sections.md, docs/20-branding.md.

ALTER TABLE "themes" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "favicon_url" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "heading_font" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "body_font" text;--> statement-breakpoint

CREATE TABLE "page_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" text DEFAULT 'home' NOT NULL,
	"type" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "page_sections_page_idx" ON "page_sections" USING btree ("page","position");--> statement-breakpoint

-- Seed the home page's current 7 sections, in their current order, all
-- visible. hero/cta/how_it_works get real config (these were the only
-- pieces of the page settings-driven or hardcoded rather than already
-- t()-driven/DB-driven) — the exact English fallback values that were
-- already live (confirmed: no `settings` rows for hero_*/cta_* ever
-- existed, so these ARE what the page has always actually rendered).
INSERT INTO "page_sections" ("page", "type", "position", "is_visible", "config") VALUES
('home', 'hero', 0, true, '{
  "titleLead": "Your AI agency, ",
  "titleAccent": "staffed by personas",
  "subtitle": "Hire a specialist for every task — a maths tutor, a copywriter, a strategist. Each one has its own expertise, personality and teaching level. Pay only for what you use.",
  "primaryLabel": "Browse personas",
  "secondaryLabel": "See pricing"
}'::jsonb),
('home', 'categories', 1, true, '{}'::jsonb),
('home', 'featured_personas', 2, true, '{}'::jsonb),
('home', 'how_it_works', 3, true, '{
  "steps": [
    { "icon": "users", "title": "Pick a persona", "body": "Each persona carries its own expertise, tone and teaching level — from early years to professional." },
    { "icon": "message-square", "title": "Talk naturally", "body": "Replies stream in as they are written. Adjust tone, format and length mid-conversation." },
    { "icon": "bolt", "title": "Pay per use", "body": "Credits are deducted per message based on real token usage. No subscription, no lock-in." }
  ]
}'::jsonb),
('home', 'pricing', 4, true, '{}'::jsonb),
('home', 'blog', 5, true, '{}'::jsonb),
('home', 'cta', 6, true, '{
  "title": "Start with free credits",
  "subtitle": "Create an account and get {credits} credits to try every persona — no card required.",
  "buttonLabel": "Create free account"
}'::jsonb);
