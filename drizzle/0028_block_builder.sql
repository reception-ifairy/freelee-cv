-- Block builder: turns page_sections from a home-page-only ordered list into a
-- reusable block system with a shared grid/layout, one level of nesting, and
-- ownership by a CMS page or a blog post.
--
-- Additive only. Existing rows keep `page = 'home'`, an empty `layout` (which
-- resolves to each block's own default), and NULL owners — so the live home
-- page renders exactly as before.

ALTER TABLE "page_sections"
  ADD COLUMN IF NOT EXISTS "layout"         jsonb   NOT NULL DEFAULT '{}'::jsonb,
  -- Lazy-migration hatch: a block type can change its config shape later and
  -- upgrade old rows on read, instead of needing a data migration.
  ADD COLUMN IF NOT EXISTS "config_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "parent_id"      integer REFERENCES "page_sections"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "page_id"        integer REFERENCES "pages"("id")         ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "post_id"        integer REFERENCES "posts"("id")         ON DELETE CASCADE;

-- Real foreign keys with ON DELETE CASCADE rather than encoding the owner into
-- the existing `page` text column: deleting a page must not leave orphan blocks
-- behind that nothing can reach or clean up.
CREATE INDEX IF NOT EXISTS "page_sections_page_id_idx" ON "page_sections" ("page_id", "position");
CREATE INDEX IF NOT EXISTS "page_sections_post_id_idx" ON "page_sections" ("post_id", "position");
CREATE INDEX IF NOT EXISTS "page_sections_parent_idx"  ON "page_sections" ("parent_id", "position");

-- Nested navigation. Without parent_id the site is structurally incapable of a
-- dropdown menu — the header selects one flat ordered list.
ALTER TABLE "menu_items"
  ADD COLUMN IF NOT EXISTS "parent_id"   integer REFERENCES "menu_items"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "icon"        text,
  ADD COLUMN IF NOT EXISTS "description" text;

CREATE INDEX IF NOT EXISTS "menu_items_parent_idx" ON "menu_items" ("parent_id", "position");

-- Opt-in per page/post. Defaulting to false means every existing markdown page
-- keeps rendering from `content` until someone deliberately switches it over.
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "use_builder" boolean NOT NULL DEFAULT false;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "use_builder" boolean NOT NULL DEFAULT false;
