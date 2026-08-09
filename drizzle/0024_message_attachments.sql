-- Image attachments on messages (2026-08-09). Additive: one jsonb column,
-- defaulting to an empty array so every existing message is unaffected.
--
-- Holds site-relative paths (/uploads/<id>.png), never base64 — the bytes go
-- to disk. A data URL here would be re-read by every history query that only
-- wanted the text. See docs/26-vision-and-images.md.

ALTER TABLE "messages" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
