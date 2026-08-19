-- Personas gain a sector.
--
-- Until now `sectors` was write-only: 103 curated rows — suitability scores,
-- risk levels, narrative fit, interaction modes — read by nothing outside
-- /admin/sectors. The reason is structural rather than an oversight: no entity
-- ever pointed at a sector, so the data had no way to reach anything.
--
-- src/lib/chat/resolve-layout.ts documents an attempt to use it anyway, by
-- flattening every sector's interaction modes up to the category. It was
-- reverted because a five-sector category nearly always contains one NARRATOR
-- and one FAQ sector, so the rules fired for 20 of 20 categories and
-- mis-assigned Education, Legal and Health. The missing piece was this column.
--
-- Nullable and SET NULL: a persona without a sector is a normal state, and
-- deleting a sector must never delete the specialists filed under it.

ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "sector_id" integer
  REFERENCES "sectors"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "personas_sector_idx" ON "personas" ("sector_id")
  WHERE "sector_id" IS NOT NULL;
