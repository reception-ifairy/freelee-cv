-- Leads captured by the assistant's conversational tools.
--
-- The design this is adapted from keeps leads in a module-level array, which
-- loses every one on restart. A lead is someone who asked to be contacted;
-- losing it is worse than never offering the button.

CREATE TABLE IF NOT EXISTS "leads" (
  "id"         serial PRIMARY KEY,
  -- 'free_trial' | 'callback' | 'subscribe' | 'info_pack' | 'discount'
  "kind"       text NOT NULL,
  "name"       text,
  "email"      text,
  "phone"      text,
  "note"       text,
  -- Whatever else the tool collected, so a new tool needs no migration.
  "meta"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Where it came from. Nulls out with the conversation; the lead survives,
  -- because it is a person waiting for a reply, not a chat artefact.
  "chat_id"    text REFERENCES "chats"("id") ON DELETE SET NULL,
  "persona_id" integer REFERENCES "personas"("id") ON DELETE SET NULL,
  "user_id"    text REFERENCES "users"("id") ON DELETE SET NULL,
  "status"     text NOT NULL DEFAULT 'new',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "leads_kind_idx"   ON "leads" ("kind", "created_at" DESC);
