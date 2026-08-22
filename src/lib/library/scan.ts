import 'server-only';
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { libraryDocuments, libraryCollections, libraryCollectionDocuments } from '@/db/schema';
import { LIBRARY_ROOT, collectionKeyFor, isLibraryFile } from './paths';

/**
 * Reading the folder and telling the panel what is in it.
 *
 * Scanning **discovers**, it never processes. That separation is the point of
 * the whole section: files appear on the shelf marked "not processed yet" and
 * stay that way until somebody presses a button. A watcher that embedded
 * whatever appeared would be less code and much worse — money is spent and
 * text leaves the building, so it is a decision, not an event.
 */

const MAX_DEPTH = 6;

export type ScanSummary = {
  added: number;
  changed: number;
  unchanged: number;
  missing: number;
  collections: string[];
};

/**
 * Hashed by streaming, deliberately.
 *
 * `readFileSync` on a 40 MB book blocks the event loop for long enough that
 * the job worker's heartbeat stops, the job is reclaimed as stale after 90
 * seconds, and the same book gets processed twice, concurrently. The claim in
 * ingest.ts would catch that — but not blocking in the first place is better
 * than relying on a lock to clean up after you.
 */
async function hashFile(absPath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(absPath), hash);
  return hash.digest('hex');
}

type FoundFile = { relativePath: string; filename: string; bytes: number };

async function walk(dir: string, depth: number, root: string, out: FoundFile[]): Promise<void> {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory is a fact about the disk, not a scan failure
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    // Not `entry.isDirectory()`: a symlinked directory reports as a link, and
    // following one would walk out of the library. Regular files only.
    if (entry.isDirectory()) {
      await walk(full, depth + 1, root, out);
      continue;
    }
    if (!entry.isFile() || !isLibraryFile(entry.name)) continue;
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) continue;
    out.push({ relativePath: path.relative(root, full), filename: entry.name, bytes: stat.size });
  }
}

/** A collection per folder, created on sight. Idempotent. */
async function ensureCollection(key: string): Promise<number> {
  const label = key.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const [row] = await db
    .insert(libraryCollections)
    .values({ key, label, fromFolder: true })
    .onConflictDoUpdate({ target: libraryCollections.key, set: { updatedAt: new Date() } })
    .returning({ id: libraryCollections.id });
  return row.id;
}

/** A readable title from a filename, before the PDF's own metadata is known. */
function titleFrom(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function scanLibrary(addedBy?: string | null): Promise<ScanSummary> {
  const root = path.resolve(LIBRARY_ROOT);
  await fs.mkdir(root, { recursive: true });

  const found: FoundFile[] = [];
  await walk(root, 0, root, found);

  const existing = await db
    .select({
      id: libraryDocuments.id,
      sourcePath: libraryDocuments.sourcePath,
      sha256: libraryDocuments.sha256,
      status: libraryDocuments.status,
    })
    .from(libraryDocuments);
  const byPath = new Map(existing.map((row) => [row.sourcePath, row]));

  const summary: ScanSummary = { added: 0, changed: 0, unchanged: 0, missing: 0, collections: [] };
  const collections = new Set<string>();

  for (const file of found) {
    const sha = await hashFile(path.join(root, file.relativePath));
    const prior = byPath.get(file.relativePath);

    let documentId: string;
    if (!prior) {
      const [row] = await db
        .insert(libraryDocuments)
        .values({
          sourcePath: file.relativePath,
          filename: file.filename,
          sha256: sha,
          title: titleFrom(file.filename),
          bytes: file.bytes,
          addedBy: addedBy ?? null,
        })
        .returning({ id: libraryDocuments.id });
      documentId = row.id;
      summary.added++;
    } else {
      documentId = prior.id;
      if (prior.sha256 !== sha) {
        // The file changed on disk. Back to 'pending' — its passages are now
        // describing a document that no longer exists, and re-processing is a
        // decision for the operator, not something to do automatically.
        await db
          .update(libraryDocuments)
          .set({ sha256: sha, bytes: file.bytes, status: 'pending', error: null, updatedAt: new Date() })
          .where(eq(libraryDocuments.id, documentId));
        summary.changed++;
      } else {
        if (prior.status === 'missing') {
          await db
            .update(libraryDocuments)
            .set({ status: 'pending', error: null, updatedAt: new Date() })
            .where(eq(libraryDocuments.id, documentId));
        }
        summary.unchanged++;
      }
    }

    const key = collectionKeyFor(file.relativePath);
    if (key) {
      collections.add(key);
      const collectionId = await ensureCollection(key);
      await db
        .insert(libraryCollectionDocuments)
        .values({ collectionId, documentId })
        .onConflictDoNothing();
    }
  }

  // Rows whose file is gone are flagged, never deleted: an unmounted volume
  // would otherwise wipe the whole index, and the passages are still perfectly
  // good answers to questions.
  const livePaths = found.map((f) => f.relativePath);
  const stale = await db
    .update(libraryDocuments)
    .set({ status: 'missing', updatedAt: new Date() })
    .where(
      livePaths.length > 0
        ? sql`${notInArray(libraryDocuments.sourcePath, livePaths)} and ${libraryDocuments.status} <> 'missing'`
        : sql`${libraryDocuments.status} <> 'missing'`,
    )
    .returning({ id: libraryDocuments.id });
  summary.missing = stale.length;

  summary.collections = [...collections].sort();
  return summary;
}

/** Documents waiting to be processed, oldest first. Used by the sweeper and the CLI. */
export async function pendingDocumentIds(limit: number): Promise<string[]> {
  const rows = await db
    .select({ id: libraryDocuments.id })
    .from(libraryDocuments)
    .where(inArray(libraryDocuments.status, ['pending']))
    .orderBy(libraryDocuments.createdAt)
    .limit(limit);
  return rows.map((r) => r.id);
}
