-- Translation module, admin panel add-on: DB-backed locale registry so
-- /admin/translations can add a language at runtime (AI-driven pipeline,
-- "frozen"/pending until translated, then active/selectable). Purely
-- additive: one new table, seeded with the two locales already in use so
-- the admin UI has something to show immediately. See docs/17-translations.md.

CREATE TYPE "public"."locale_status" AS ENUM('pending', 'active');--> statement-breakpoint

CREATE TABLE "locales" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "locale_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

INSERT INTO "locales" ("code", "name", "status") VALUES ('en', 'English', 'active');--> statement-breakpoint
INSERT INTO "locales" ("code", "name", "status") VALUES ('pl', 'Polish', 'active');
