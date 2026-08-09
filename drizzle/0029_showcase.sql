-- Showcase: curated examples of what the assistants actually produce.
--
-- Deliberately its own table rather than a view over `messages`. Once an admin
-- promotes a piece it becomes the site's own marketing asset: it must survive
-- the conversation being deleted, and it must never change because a customer
-- edited or removed something. Curation is also the privacy boundary — nothing
-- a customer generates is published unless someone chose it.

CREATE TABLE IF NOT EXISTS "showcase_items" (
  "id"          serial PRIMARY KEY,
  "title"       text NOT NULL,
  "caption"     text,
  "media_url"   text NOT NULL,
  "media_type"  text NOT NULL DEFAULT 'image/png',
  -- The ask that produced it. Showing the prompt is what turns a pretty picture
  -- into a demonstration of the product, but it is optional per item because a
  -- real customer prompt can carry details they would not want published.
  "prompt"      text,
  "show_prompt" boolean NOT NULL DEFAULT true,
  "persona_id"  integer REFERENCES "personas"("id") ON DELETE SET NULL,
  -- Provenance. Nulls out with the conversation; the showcase entry survives.
  "message_id"  text REFERENCES "messages"("id") ON DELETE SET NULL,
  "position"    integer NOT NULL DEFAULT 0,
  "is_visible"  boolean NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "showcase_order_idx"   ON "showcase_items" ("is_visible", "position");
CREATE INDEX IF NOT EXISTS "showcase_persona_idx" ON "showcase_items" ("persona_id");
