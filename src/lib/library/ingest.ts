import 'server-only';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { libraryDocuments, libraryChunks, libraryChunkVectors } from '@/db/schema';
import { resolveLibraryPath } from './paths';
import { extractPdf } from './extract-pdf';
import { cleanPages, type Page } from './clean';
import { chunkPages, type Passage } from './chunk';
import { embedPassages } from './embed';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Turning one file into passages a bot can search.
 *
 * This is the single implementation. The queue calls it and so does the CLI
 * backfill — two entry points, one code path, because two divergent copies of
 * a pipeline this long is how the CLI quietly stops matching what production
 * actually does.
 *
 * **Idempotent by construction.** Job delivery is at-least-once, so this runs
 * twice sooner or later. Every write lands in one transaction at the end:
 * delete the document's old passages, insert the new ones, mark it ready. A
 * crash at any earlier point leaves the document exactly as it was — never
 * live-but-empty, which is what a delete-first pipeline produces.
 */

/**
 * How long a claim survives without progress before another worker may take
 * it. `library_documents` has no heartbeat of its own — unlike `jobs`, which
 * does — so without this a process killed mid-book wedges that book forever.
 */
export const CLAIM_STALE_MS = 30 * 60 * 1000;

/** Rows per INSERT. Well inside Postgres' parameter ceiling, and bounded memory. */
const INSERT_BATCH = 400;

export type IngestOptions = {
  /** Polled between stages; cancellation is cooperative, as it is for crews. */
  shouldCancel?: () => Promise<boolean> | boolean;
};

export type IngestOutcome =
  | { status: 'ready'; passages: number; tokens: number }
  | { status: 'skipped'; reason: string }
  | { status: 'needs_ocr'; detail: string }
  | { status: 'failed'; error: string };

/**
 * Take ownership of a document, or report that someone else already has it.
 *
 * One atomic UPDATE is the whole mechanism: the queue and the CLI can both be
 * running and neither can process the same book twice. Zero rows back is not
 * an error — it means another worker owns it, and the caller returns
 * successfully, which is exactly what at-least-once delivery requires.
 */
export async function claimDocument(documentId: string): Promise<boolean> {
  const staleBefore = sql`now() - interval '${sql.raw(String(CLAIM_STALE_MS))} milliseconds'`;
  const claimed = await db
    .update(libraryDocuments)
    .set({ status: 'processing', claimedAt: new Date(), error: null, updatedAt: new Date() })
    .where(
      and(
        eq(libraryDocuments.id, documentId),
        or(
          inArray(libraryDocuments.status, ['pending', 'failed']),
          // A 'processing' row whose claim has gone stale is fair game again.
          and(eq(libraryDocuments.status, 'processing'), lt(libraryDocuments.claimedAt, staleBefore)),
        ),
      ),
    )
    .returning({ id: libraryDocuments.id });
  return claimed.length > 0;
}

async function fail(documentId: string, error: string): Promise<IngestOutcome> {
  await db
    .update(libraryDocuments)
    .set({ status: 'failed', error, claimedAt: null, updatedAt: new Date() })
    .where(eq(libraryDocuments.id, documentId));
  return { status: 'failed', error };
}

/** Plain-text files skip poppler entirely — one "page" is the whole file. */
async function readPlainText(absPath: string): Promise<Page[]> {
  const text = await fs.readFile(absPath, 'utf8');
  return [{ number: 1, text }];
}

export async function ingestDocument(documentId: string, options: IngestOptions = {}): Promise<IngestOutcome> {
  const cancelled = async () => Boolean(await options.shouldCancel?.());

  if (!(await claimDocument(documentId))) {
    return { status: 'skipped', reason: 'Another worker is already processing this document.' };
  }

  const [doc] = await db.select().from(libraryDocuments).where(eq(libraryDocuments.id, documentId)).limit(1);
  if (!doc) return { status: 'skipped', reason: 'The document row disappeared mid-run.' };

  const absPath = await resolveLibraryPath(doc.sourcePath);
  if (!absPath) return fail(documentId, 'That file is outside the library folder and was not read.');

  let pages: Page[];
  let pageCount: number | null = null;
  let title = doc.title;
  let author = doc.author;
  let year = doc.year;

  try {
    if (path.extname(absPath).toLowerCase() === '.pdf') {
      const extracted = await extractPdf(absPath);
      if (!extracted.ok) {
        if (extracted.reason === 'no_text_layer') {
          await db
            .update(libraryDocuments)
            .set({
              status: 'needs_ocr',
              error: extracted.detail,
              pages: extracted.metadata?.pages ?? null,
              claimedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(libraryDocuments.id, documentId));
          return { status: 'needs_ocr', detail: extracted.detail };
        }
        return fail(documentId, extracted.detail);
      }
      pages = extracted.pages;
      pageCount = extracted.metadata.pages;
      // Only fill metadata that is still empty: a title corrected by hand in
      // the panel must survive a re-run.
      title = doc.title || extracted.metadata.title || doc.filename;
      author = doc.author ?? extracted.metadata.author;
      year = doc.year ?? extracted.metadata.year;
    } else {
      pages = await readPlainText(absPath);
    }
  } catch (error) {
    return fail(documentId, error instanceof Error ? error.message : 'The file could not be read.');
  }

  if (await cancelled()) {
    await db
      .update(libraryDocuments)
      .set({ status: 'pending', claimedAt: null, updatedAt: new Date() })
      .where(eq(libraryDocuments.id, documentId));
    return { status: 'skipped', reason: 'Cancelled before embedding.' };
  }

  const cleaned = cleanPages(pages);
  const passages: Passage[] = chunkPages(cleaned);
  const textChars = cleaned.reduce((n, page) => n + page.text.length, 0);

  if (passages.length === 0) {
    return fail(documentId, 'The file was read but contained no usable text.');
  }

  const embedded = await embedPassages(passages.map((p) => p.text));
  if (!embedded.ok) return fail(documentId, embedded.error);

  if (await cancelled()) {
    await db
      .update(libraryDocuments)
      .set({ status: 'pending', claimedAt: null, updatedAt: new Date() })
      .where(eq(libraryDocuments.id, documentId));
    return { status: 'skipped', reason: 'Cancelled after embedding.' };
  }

  await db.transaction(async (tx) => {
    // Vectors cascade from chunks, so one delete clears both.
    await tx.delete(libraryChunks).where(eq(libraryChunks.documentId, documentId));

    for (let i = 0; i < passages.length; i += INSERT_BATCH) {
      const slice = passages.slice(i, i + INSERT_BATCH);
      const inserted = await tx
        .insert(libraryChunks)
        .values(
          slice.map((p) => ({
            documentId,
            position: p.position,
            pageFrom: p.pageFrom,
            pageTo: p.pageTo,
            heading: p.heading,
            kind: p.kind,
            text: p.text,
            charCount: p.charCount,
          })),
        )
        .returning({ id: libraryChunks.id, position: libraryChunks.position });

      // RETURNING order is not guaranteed to match VALUES order, so pair by
      // position rather than by array index — the kind of assumption that
      // works in testing and mismatches a vector to the wrong passage in
      // production, where nothing would ever visibly break.
      const byPosition = new Map(inserted.map((row) => [row.position, row.id]));
      await tx.insert(libraryChunkVectors).values(
        slice.map((p) => ({
          chunkId: byPosition.get(p.position)!,
          embedding: embedded.vectors[p.position],
        })),
      );
    }

    await tx
      .update(libraryDocuments)
      .set({
        status: 'ready',
        error: null,
        claimedAt: null,
        title,
        author,
        year,
        pages: pageCount ?? doc.pages,
        textChars,
        passageCount: passages.length,
        embeddingModel: embedded.model,
        ingestTokens: embedded.tokens,
        indexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(libraryDocuments.id, documentId));
  });

  return { status: 'ready', passages: passages.length, tokens: embedded.tokens };
}
