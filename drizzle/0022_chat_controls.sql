-- Per-chat conversation controls (2026-08-08). Additive: two nullable enum
-- columns reusing the enums persona_versions already uses, so a chat can
-- override the persona's authored interaction style / approach to unknown
-- for that conversation only.
--
-- NULL = "inherit from the persona", which is every existing row, so there is
-- no backfill and no behaviour change until a user actually picks something.
-- See docs/24-chat-controls.md.

ALTER TABLE "chats" ADD COLUMN "interaction_style" "interaction_style";--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "approach_to_unknown" "approach_to_unknown";
