-- Category/audience-adaptive chat UI (2026-08-08). Additive: one nullable
-- column. NULL means "use the layout suggested from the persona's category,
-- audience and narrative-fit signals" (suggestLayoutForPersona in
-- src/lib/chat/layouts.ts), so every existing persona gets a sensible chat UI
-- with no backfill and no behaviour change until an admin sets one
-- explicitly. See docs/23-chat-layouts.md.
--
-- Group (room) layouts are NOT here on purpose: conversations.settings is
-- already a jsonb bag documented for exactly this kind of per-room override,
-- so a room's layout lives at settings->>'chatLayout' and needs no schema
-- change at all.

ALTER TABLE "persona_versions" ADD COLUMN "chat_layout" text;
