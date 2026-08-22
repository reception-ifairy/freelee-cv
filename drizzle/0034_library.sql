-- The Knowledgebase: a private document library the personas can read.
--
-- Everything before this migration grounds a persona from *external* REST
-- APIs (`knowledge_sources`, docs/18) — there has never been a local index of
-- anything. This adds one: PDFs on disk become text, text becomes passages,
-- passages become vectors, and a persona granted a collection retrieves from
-- them. See docs/48-knowledgebase.md.
--
-- Three shape decisions worth stating, because each one has a cheaper-looking
-- alternative that is wrong:
--
-- 1. `source_path` is the identity, not `sha256`. The scanner's view of a
--    document is its path; the hash is how we notice the file *changed*.
--    Making the hash unique would turn "the author sent me a corrected PDF"
--    into a duplicate row with the old passages still live.
--
-- 2. Vectors live in their own table. A combined row would be text (~2 KB) +
--    tsvector (~3 KB) + vector(1536) (6,152 B) — past the 8 KB page, so
--    Postgres would attempt pglz compression on float32 data (near
--    incompressible; pure wasted CPU on every insert) and then TOAST it out
--    of line, making every scan pay a detoast. Split, the vector table is one
--    tuple per page, and re-embedding with a different model is a TRUNCATE
--    rather than a migration.
--
-- 3. No HNSW index yet, deliberately. pgvector 0.6.0 is the newest packaged
--    for Ubuntu 24.04 (no PGDG repo here), and it applies a WHERE filter
--    *after* the ANN scan — so a query restricted to one collection can come
--    back with two rows or none. `hnsw.iterative_scan`, which fixes exactly
--    that, landed in 0.8.0. An exact cosine scan over ~160k vectors is a few
--    hundred milliseconds with perfect recall and no tuning, so we ship exact,
--    measure, and add the index only if the number justifies it.
--
-- Platform-wide, no team_id: one operator curates one library for their own
-- bots, the same scope line `knowledge_sources` draws. Per-team libraries
-- would need team_id on documents *and* on every retrieval query.

-- Requires the `vector` extension, which needs superuser:
--   sudo -u postgres psql -d aigency_freelee -c 'CREATE EXTENSION IF NOT EXISTS vector'
-- Left out of this file on purpose so the migration itself runs as the app role.

DO $$ BEGIN
  CREATE TYPE "library_doc_status" AS ENUM (
    -- Discovered on disk, nothing done to it. Nothing is ever processed by
    -- simply existing — the operator presses a button.
    'pending',
    'processing',
    'ready',
    'failed',
    -- A scan with no text layer. Not a failure: a backlog item for OCR, kept
    -- distinct so it can be retried in bulk when OCR exists.
    'needs_ocr',
    -- The row outlived its file. Never deleted automatically — an unmounted
    -- volume must not wipe the index.
    'missing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "library_doc_kind" AS ENUM ('book', 'paper', 'notes', 'manual', 'reference', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Bibliographies and indexes are hundreds of dense, high-lexical-noise
  -- entries. Left in the pool they dominate keyword search and burn embedding
  -- budget, so they are kept (a citation is sometimes what you want) but
  -- excluded from retrieval by default.
  CREATE TYPE "library_chunk_kind" AS ENUM ('body', 'frontmatter', 'backmatter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library_documents" (
  "id"              text PRIMARY KEY,
  -- Path relative to LIBRARY_ROOT. The first segment is the collection, so
  -- dropping a file into `operations/` files it on that shelf without anyone
  -- ticking a box — the only way 500 books is manageable.
  "source_path"     text NOT NULL,
  "filename"        text NOT NULL,
  -- Change detector, not identity. Streamed, never read whole into memory:
  -- a 90-second synchronous block would let the job worker reclaim the job
  -- and run it a second time, concurrently.
  "sha256"          text,
  "title"           text NOT NULL,
  "author"          text,
  "year"            integer,
  "publisher"       text,
  "kind"            "library_doc_kind" NOT NULL DEFAULT 'book',
  "language"        text NOT NULL DEFAULT 'en',
  "bytes"           bigint NOT NULL DEFAULT 0,
  "pages"           integer,
  "status"          "library_doc_status" NOT NULL DEFAULT 'pending',
  -- Written for a person, not a log: it is rendered verbatim in the panel.
  "error"           text,
  -- `library_documents` has no heartbeat of its own (unlike `jobs`), so a
  -- crashed run would wedge a book forever. A `processing` row older than the
  -- reclaim window is claimable again.
  "claimed_at"      timestamp with time zone,
  "attempts"        integer NOT NULL DEFAULT 0,
  "text_chars"      integer NOT NULL DEFAULT 0,
  "passage_count"   integer NOT NULL DEFAULT 0,
  -- Which model produced this document's vectors. Vectors from two different
  -- models are not comparable, so this is what makes "which books still need
  -- re-embedding" answerable without guessing.
  "embedding_model" text,
  -- Ingest has no billing home: usage_events.team_id is NOT NULL and a
  -- platform-wide backfill has no team. Recorded here and summed for the panel.
  "ingest_tokens"   bigint NOT NULL DEFAULT 0,
  "category_id"     integer REFERENCES "categories"("id") ON DELETE SET NULL,
  "sector_id"       integer REFERENCES "sectors"("id") ON DELETE SET NULL,
  "added_by"        text REFERENCES "users"("id") ON DELETE SET NULL,
  "indexed_at"      timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_documents_path_idx" ON "library_documents" ("source_path");
CREATE INDEX IF NOT EXISTS "library_documents_status_idx" ON "library_documents" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "library_documents_sha_idx" ON "library_documents" ("sha256");

-- Same shape as `knowledge_sources` (serial + key + label + is_active) because
-- it plays the same role: the thing a persona is granted.
CREATE TABLE IF NOT EXISTS "library_collections" (
  "id"          serial PRIMARY KEY,
  "key"         text NOT NULL,
  "label"       text NOT NULL,
  "description" text,
  -- Set when the collection was created by the scanner from a folder name,
  -- rather than by hand. Only used to explain itself in the panel.
  "from_folder" boolean NOT NULL DEFAULT false,
  "is_active"   boolean NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_collections_key_idx" ON "library_collections" ("key");

CREATE TABLE IF NOT EXISTS "library_collection_documents" (
  "collection_id" integer NOT NULL REFERENCES "library_collections"("id") ON DELETE CASCADE,
  "document_id"   text NOT NULL REFERENCES "library_documents"("id") ON DELETE CASCADE,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("collection_id", "document_id")
);

CREATE INDEX IF NOT EXISTS "library_collection_documents_doc_idx"
  ON "library_collection_documents" ("document_id");

CREATE TABLE IF NOT EXISTS "library_chunks" (
  "id"          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "document_id" text NOT NULL REFERENCES "library_documents"("id") ON DELETE CASCADE,
  -- Stable ordinal within the document. It is what makes read-time context
  -- expansion possible: retrieve a passage, then fetch position ± 1 and stitch,
  -- which beats storing large overlapping passages and costs ~15% less to embed.
  "position"    integer NOT NULL,
  "page_from"   integer,
  "page_to"     integer,
  "heading"     text,
  "kind"        "library_chunk_kind" NOT NULL DEFAULT 'body',
  "text"        text NOT NULL,
  "char_count"  integer NOT NULL DEFAULT 0,
  -- Generated, not written: the keyword leg of hybrid search can never drift
  -- out of sync with the text it indexes. 'english' because the corpus is
  -- mainly English and this server has no Polish stemmer installed.
  "tsv"         tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_chunks_doc_position_idx"
  ON "library_chunks" ("document_id", "position");
CREATE INDEX IF NOT EXISTS "library_chunks_tsv_idx" ON "library_chunks" USING gin ("tsv");

CREATE TABLE IF NOT EXISTS "library_chunk_vectors" (
  "chunk_id"  bigint PRIMARY KEY REFERENCES "library_chunks"("id") ON DELETE CASCADE,
  "embedding" vector(1536) NOT NULL
);

-- PLAIN, not the default EXTENDED: a 6,152-byte float32 array is
-- near-incompressible, so the default storage would spend CPU on every insert
-- trying to compress it and then push it out of line anyway. PLAIN keeps it in
-- the tuple, which is affordable precisely because this table has one other
-- column. See the header note.
DO $$ BEGIN
  ALTER TABLE "library_chunk_vectors" ALTER COLUMN "embedding" SET STORAGE PLAIN;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;
