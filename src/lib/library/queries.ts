import 'server-only';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { libraryDocuments, libraryChunks, libraryCollections, libraryCollectionDocuments } from '@/db/schema';

/**
 * Read-side queries for the Knowledgebase.
 *
 * Deliberately NOT in `server/actions/admin-knowledgebase.ts`: **every export
 * from a `'use server'` file is a callable HTTP endpoint**, so a query living
 * there is a public API whether you meant it or not. This codebase has been
 * bitten by that before — `listPromotableMessages` once exposed customer
 * messages that way.
 */

export type DocumentRow = {
  id: string;
  title: string;
  author: string | null;
  filename: string;
  sourcePath: string;
  status: string;
  error: string | null;
  pages: number | null;
  bytes: number;
  passageCount: number;
  textChars: number;
  embeddingModel: string | null;
  ingestTokens: number;
  indexedAt: Date | null;
  collections: string;
};

export async function listDocuments(): Promise<DocumentRow[]> {
  return db
    .select({
      id: libraryDocuments.id,
      title: libraryDocuments.title,
      author: libraryDocuments.author,
      filename: libraryDocuments.filename,
      sourcePath: libraryDocuments.sourcePath,
      status: sql<string>`${libraryDocuments.status}`,
      error: libraryDocuments.error,
      pages: libraryDocuments.pages,
      bytes: libraryDocuments.bytes,
      passageCount: libraryDocuments.passageCount,
      textChars: libraryDocuments.textChars,
      embeddingModel: libraryDocuments.embeddingModel,
      ingestTokens: libraryDocuments.ingestTokens,
      indexedAt: libraryDocuments.indexedAt,
      /*
       * `sql.raw('"library_documents"."id"')`, not `${libraryDocuments.id}`.
       *
       * Drizzle emits a bare `"id"` for the FROM-table's own column inside a
       * `sql` template, and inside a correlated subquery Postgres resolves that
       * against the INNER table — so the condition compares each row to its
       * own id and is always false. That bug has appeared in this admin four
       * times now (/admin/packs 500, /admin/customers silent zeros,
       * /admin/projects, /admin/taxonomy). Qualifying explicitly is the fix.
       */
      collections: sql<string>`(
        select coalesce(string_agg(lc.label, ', ' order by lc.label), '')
        from ${libraryCollectionDocuments} lcd
        join ${libraryCollections} lc on lc.id = lcd.collection_id
        where lcd.document_id = ${sql.raw('"library_documents"."id"')}
      )`,
    })
    .from(libraryDocuments)
    .orderBy(asc(libraryDocuments.sourcePath));
}

export async function getDocument(id: string) {
  const [row] = await db.select().from(libraryDocuments).where(eq(libraryDocuments.id, id)).limit(1);
  return row ?? null;
}

/** Passages for the viewer — the screen where a person judges whether any of this worked. */
export async function listPassages(documentId: string, offset = 0, limit = 25) {
  return db
    .select({
      id: libraryChunks.id,
      position: libraryChunks.position,
      pageFrom: libraryChunks.pageFrom,
      pageTo: libraryChunks.pageTo,
      heading: libraryChunks.heading,
      kind: sql<string>`${libraryChunks.kind}`,
      text: libraryChunks.text,
      charCount: libraryChunks.charCount,
      embedded: sql<boolean>`exists (select 1 from library_chunk_vectors v where v.chunk_id = ${sql.raw('"library_chunks"."id"')})`,
    })
    .from(libraryChunks)
    .where(eq(libraryChunks.documentId, documentId))
    .orderBy(asc(libraryChunks.position))
    .limit(limit)
    .offset(offset);
}

export async function collectionsForDocument(documentId: string) {
  return db
    .select({ id: libraryCollections.id, key: libraryCollections.key, label: libraryCollections.label })
    .from(libraryCollectionDocuments)
    .innerJoin(libraryCollections, eq(libraryCollections.id, libraryCollectionDocuments.collectionId))
    .where(eq(libraryCollectionDocuments.documentId, documentId));
}

export async function listCollections() {
  return db
    .select({
      id: libraryCollections.id,
      key: libraryCollections.key,
      label: libraryCollections.label,
      description: libraryCollections.description,
      fromFolder: libraryCollections.fromFolder,
      isActive: libraryCollections.isActive,
      documents: sql<number>`(select count(*)::int from ${libraryCollectionDocuments} lcd
                              where lcd.collection_id = ${sql.raw('"library_collections"."id"')})`,
      passages: sql<number>`(select coalesce(sum(d.passage_count), 0)::int
                             from ${libraryCollectionDocuments} lcd
                             join ${libraryDocuments} d on d.id = lcd.document_id
                             where lcd.collection_id = ${sql.raw('"library_collections"."id"')})`,
    })
    .from(libraryCollections)
    .orderBy(asc(libraryCollections.label));
}

/** The numbers across the top of the shelf. One query, not five. */
export async function libraryTotals() {
  const [row] = await db
    .select({
      documents: sql<number>`count(*)::int`,
      ready: sql<number>`count(*) filter (where ${libraryDocuments.status} = 'ready')::int`,
      pending: sql<number>`count(*) filter (where ${libraryDocuments.status} = 'pending')::int`,
      working: sql<number>`count(*) filter (where ${libraryDocuments.status} = 'processing')::int`,
      failed: sql<number>`count(*) filter (where ${libraryDocuments.status} in ('failed', 'needs_ocr', 'missing'))::int`,
      passages: sql<number>`coalesce(sum(${libraryDocuments.passageCount}), 0)::int`,
      tokens: sql<number>`coalesce(sum(${libraryDocuments.ingestTokens}), 0)::bigint`,
      bytes: sql<number>`coalesce(sum(${libraryDocuments.bytes}), 0)::bigint`,
    })
    .from(libraryDocuments);
  return row;
}
