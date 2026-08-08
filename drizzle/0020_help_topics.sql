-- "?" help tips (2026-08-08). Additive: one new table holding only the video
-- URL per topic. The tip *text* is not here on purpose — it lives as
-- t('help.…') call sites in src/lib/help/topics.ts so the translation
-- pipeline can see and translate it (docs/22-help-tips.md).
--
-- Seeds nothing: every topic renders as text-only until an admin attaches a
-- video, which is the correct state today since the instructional-video
-- feature itself is not built yet.

CREATE TABLE "help_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"video_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "help_topics_key_idx" ON "help_topics" USING btree ("key");
