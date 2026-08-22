'use server';

// Named admin-knowledgebase.ts, not admin/knowledgebase.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'node:fs';
import { db } from '@/db';
import { libraryDocuments, libraryCollections, libraryCollectionDocuments } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { scanLibrary } from '@/lib/library/scan';
import { requestLibrarySweep } from '@/lib/library/job';
import { searchLibrary } from '@/lib/library/search';
import { resolveLibraryPath } from '@/lib/library/paths';
import type { ActionState } from './auth';

/**
 * Everything the Knowledgebase panel can do.
 *
 * The rule the whole section is built around: **scanning discovers, it never
 * processes.** Finding a file and embedding it are two separate actions with
 * two separate buttons, because the second one spends money and sends text to
 * an external API. A watcher that embedded whatever appeared would be less
 * code and a worse product.
 */

export async function scanLibraryAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  const summary = await scanLibrary(admin.id);
  revalidatePath('/admin/knowledgebase');

  const parts = [
    summary.added ? `${summary.added} new` : null,
    summary.changed ? `${summary.changed} changed on disk` : null,
    summary.missing ? `${summary.missing} no longer on disk` : null,
  ].filter(Boolean);

  return {
    success: parts.length
      ? `Found ${parts.join(', ')}. ${summary.unchanged} already known.`
      : `Nothing new — all ${summary.unchanged} document(s) already known.`,
  };
}

const idsSchema = z.object({ ids: z.array(z.string().min(1)).min(1, 'Choose at least one document.') });

/**
 * Queue documents for processing.
 *
 * Sets them back to `pending` and asks for a sweep. It does not do the work
 * inline: a book takes tens of seconds and nginx cuts the request at 300.
 */
export async function processDocumentsAction(ids: string[]): Promise<ActionState> {
  await requireAdmin();
  const parsed = idsSchema.safeParse({ ids });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(libraryDocuments)
    .set({ status: 'pending', error: null, claimedAt: null, updatedAt: new Date() })
    .where(inArray(libraryDocuments.id, parsed.data.ids));

  await requestLibrarySweep();
  revalidatePath('/admin/knowledgebase');
  return {
    success: `${parsed.data.ids.length} document(s) queued. Processing runs in the background — this page updates as it goes.`,
  };
}

const removeSchema = z.object({
  id: z.string().min(1),
  /** 'passages' forgets what was learned; 'file' also deletes the PDF from the folder. */
  scope: z.enum(['passages', 'file']),
});

export async function removeDocumentAction(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = removeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'That request did not make sense.' };

  const [doc] = await db
    .select({ id: libraryDocuments.id, sourcePath: libraryDocuments.sourcePath, title: libraryDocuments.title })
    .from(libraryDocuments)
    .where(eq(libraryDocuments.id, parsed.data.id))
    .limit(1);
  if (!doc) return { error: 'That document is no longer here.' };

  if (parsed.data.scope === 'file') {
    // Resolve before deleting: `source_path` decides what gets unlinked, and a
    // path that escapes the library root must never reach fs.rm.
    const absolute = await resolveLibraryPath(doc.sourcePath);
    if (!absolute) return { error: 'That file is outside the library folder — nothing was deleted.' };
    await fs.rm(absolute, { force: true });
  }

  // Chunks and vectors cascade from the document row.
  await db.delete(libraryDocuments).where(eq(libraryDocuments.id, doc.id));
  revalidatePath('/admin/knowledgebase');

  return {
    success:
      parsed.data.scope === 'file'
        ? `Deleted “${doc.title}” and its file.`
        : `Removed “${doc.title}” from the knowledgebase. The file is still in the folder.`,
  };
}

const collectionSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(2, 'Give the collection a name.').max(120),
  description: z.string().trim().max(1000).optional(),
});

export async function saveCollectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = collectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, label, description } = parsed.data;
  if (id) {
    // The key is deliberately not regenerated from the label. Personas are
    // granted collections *by key*, so renaming a collection would silently
    // revoke every persona's access to it — the same trap category slugs had
    // (docs/47) and the same fix.
    await db
      .update(libraryCollections)
      .set({ label, description: description || null, updatedAt: new Date() })
      .where(eq(libraryCollections.id, Number(id)));
  } else {
    await db
      .insert(libraryCollections)
      .values({ key: slugify(label), label, description: description || null })
      .onConflictDoNothing();
  }

  revalidatePath('/admin/knowledgebase/collections');
  return { success: `Saved “${label}”.` };
}

export async function setDocumentCollectionsAction(documentId: string, collectionIds: number[]): Promise<ActionState> {
  await requireAdmin();

  await db.transaction(async (tx) => {
    await tx.delete(libraryCollectionDocuments).where(eq(libraryCollectionDocuments.documentId, documentId));
    if (collectionIds.length > 0) {
      await tx
        .insert(libraryCollectionDocuments)
        .values(collectionIds.map((collectionId) => ({ collectionId, documentId })))
        .onConflictDoNothing();
    }
  });

  revalidatePath(`/admin/knowledgebase/${documentId}`);
  return { success: 'Shelves updated.' };
}

export type TestResult = { citation: string; title: string; text: string }[];

/**
 * The test-question box.
 *
 * This is the single control that makes retrieval legible to someone who has
 * not done this before: ask a question, see exactly which passages a bot would
 * be handed. Everything else in the panel describes the pipeline; this shows
 * its output.
 */
export async function testQuestionAction(
  collectionKeys: string[],
  question: string,
): Promise<{ error?: string; results?: TestResult }> {
  await requireAdmin();
  const trimmed = question.trim();
  if (trimmed.length < 3) return { error: 'Ask a slightly longer question.' };
  if (collectionKeys.length === 0) return { error: 'This document is not on any shelf yet, so nothing can find it.' };

  const hits = await searchLibrary(collectionKeys, trimmed, { k: 5 });
  return { results: hits.map((h) => ({ citation: h.citation, title: h.title, text: h.text })) };
}
