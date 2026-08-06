-- Translation module, phase 1 (landing/frontend surface). Purely additive:
-- one new table. English is never stored here — it's always the literal
-- fallback already at each t(key, fallback) call site (src/lib/i18n/translate.ts).
-- See docs/17-translations.md.

CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "translations_unique_idx" ON "translations" USING btree ("namespace","key","locale");
