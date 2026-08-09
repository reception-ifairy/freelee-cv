'use server';

// Named admin-frontpage.ts, not admin/frontpage.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-knowledge-sources.ts.
//
// Despite the name this now serves every block scope: the home page, a CMS page
// and a blog post all use the same table and the same actions, keyed by
// `BlockScope`. The file name is kept so links and imports elsewhere still
// resolve; renaming it is cosmetic churn for no gain.

import { z } from 'zod';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { pages, pageSections, posts } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { blockMeta, canNest, isBlockKey } from '@/lib/blocks/catalog';
import { validateBlockConfig } from '@/lib/blocks/validate';
import { resolveLayout } from '@/lib/blocks/layout';
import type { ActionState } from './auth';

/** Which collection of blocks an action is operating on. */
const scopeSchema = z.object({
  page: z.string().min(1).max(40).default('home'),
  pageId: z.coerce.number().int().positive().optional(),
  postId: z.coerce.number().int().positive().optional(),
});
export type BlockScope = z.infer<typeof scopeSchema>;

function scopeFrom(formData: FormData): BlockScope {
  return scopeSchema.parse({
    page: formData.get('page') ?? 'home',
    pageId: formData.get('pageId') || undefined,
    postId: formData.get('postId') || undefined,
  });
}

function scopeWhere(scope: BlockScope) {
  if (scope.pageId) return eq(pageSections.pageId, scope.pageId);
  if (scope.postId) return eq(pageSections.postId, scope.postId);
  return and(eq(pageSections.page, scope.page), isNull(pageSections.pageId), isNull(pageSections.postId));
}

/**
 * Repaint everything a block change could be visible on.
 *
 * The builder route itself has to be listed explicitly. Revalidating
 * `/admin/pages` does not cover `/admin/pages/[id]/builder`, so without these
 * the list of blocks stayed stale after adding one — the row was written, the
 * screen just did not show it.
 */
function revalidateScope(scope: BlockScope) {
  revalidatePath('/', 'layout');
  revalidatePath('/admin/frontpage');
  if (scope.pageId) {
    revalidatePath('/admin/pages');
    revalidatePath(`/admin/pages/${scope.pageId}/builder`);
  }
  if (scope.postId) {
    revalidatePath('/admin/posts');
    revalidatePath(`/admin/posts/${scope.postId}/builder`);
  }
}

export async function toggleSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const isVisible = formData.get('isVisible') === 'true';
  await db.update(pageSections).set({ isVisible: !isVisible, updatedAt: new Date() }).where(eq(pageSections.id, id));
  revalidateScope(scopeFrom(formData));
}

/** Swaps `position` with the block immediately above/below. Kept alongside drag-and-drop as an unambiguous fallback that works with no JavaScript at all. */
export async function moveSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const direction = z.enum(['up', 'down']).parse(formData.get('direction'));
  const scope = scopeFrom(formData);

  const [target] = await db.select().from(pageSections).where(eq(pageSections.id, id)).limit(1);
  if (!target) return;

  // Siblings only — a block inside a container reorders within that container.
  const siblings = await db
    .select()
    .from(pageSections)
    .where(target.parentId === null ? and(scopeWhere(scope), isNull(pageSections.parentId)) : eq(pageSections.parentId, target.parentId))
    .orderBy(asc(pageSections.position));

  const index = siblings.findIndex((r) => r.id === id);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const a = siblings[index];
  const b = siblings[swapIndex];
  await db.transaction(async (tx) => {
    await tx.update(pageSections).set({ position: b.position, updatedAt: new Date() }).where(eq(pageSections.id, a.id));
    await tx.update(pageSections).set({ position: a.position, updatedAt: new Date() }).where(eq(pageSections.id, b.id));
  });

  revalidateScope(scope);
}

/**
 * Persists a whole ordering in one request — what drag-and-drop submits.
 *
 * Only ids already in the target scope are written. Without that check, a
 * crafted payload could drag a block out of somebody else's page by id.
 */
export async function reorderSectionsAction(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const scope = scopeFrom(formData);

  const parsed = z.array(z.number().int().positive()).safeParse(JSON.parse(String(formData.get('order') ?? '[]')));
  if (!parsed.success) return { error: 'That ordering could not be read.' };
  const order = parsed.data;
  if (order.length === 0) return { success: 'Nothing to reorder.' };

  const parentIdRaw = formData.get('parentId');
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  const allowed = await db
    .select({ id: pageSections.id })
    .from(pageSections)
    .where(parentId ? eq(pageSections.parentId, parentId) : and(scopeWhere(scope), isNull(pageSections.parentId)));

  const allowedIds = new Set(allowed.map((r) => r.id));
  const clean = order.filter((id) => allowedIds.has(id));
  if (clean.length !== order.length) return { error: 'Some of those blocks do not belong to this page.' };

  await db.transaction(async (tx) => {
    for (const [index, id] of clean.entries()) {
      await tx.update(pageSections).set({ position: index, updatedAt: new Date() }).where(eq(pageSections.id, id));
    }
  });

  revalidateScope(scope);
  return { success: 'Order saved.' };
}

/**
 * Saves a block's content and layout together, validated against the block's
 * declared field schema rather than a per-type zod schema. The result is
 * rebuilt from the declared fields, so unknown keys in the payload are dropped
 * rather than written into the jsonb column.
 */
export async function saveBlockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [row] = await db.select().from(pageSections).where(eq(pageSections.id, id)).limit(1);
  if (!row) return { error: 'That block no longer exists.' };

  let rawConfig: unknown = {};
  let rawLayout: unknown = {};
  try {
    rawConfig = JSON.parse(String(formData.get('config') ?? '{}'));
    rawLayout = JSON.parse(String(formData.get('layout') ?? '{}'));
  } catch {
    return { error: 'That block could not be read. Please reload and try again.' };
  }

  const result = validateBlockConfig(row.type, rawConfig);
  if (!result.ok) return { error: result.error };

  await db
    .update(pageSections)
    .set({ config: result.config, layout: resolveLayout(rawLayout), updatedAt: new Date() })
    .where(eq(pageSections.id, id));

  revalidateScope(scopeFrom(formData));
  return { success: 'Block saved.' };
}

export async function createSectionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const scope = scopeFrom(formData);
  const type = String(formData.get('type') ?? 'custom_content');
  const parentIdRaw = formData.get('parentId');
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  const meta = blockMeta(type);
  if (!meta || !isBlockKey(type)) return;

  // Non-repeatable blocks are singletons. Enforced here rather than only hidden
  // in the picker, so a replayed request cannot create a second hero.
  if (!meta.repeatable) {
    const [existing] = await db
      .select({ id: pageSections.id })
      .from(pageSections)
      .where(and(scopeWhere(scope), eq(pageSections.type, type)))
      .limit(1);
    if (existing) return;
  }

  if (parentId !== null) {
    const [parent] = await db.select().from(pageSections).where(eq(pageSections.id, parentId)).limit(1);
    // One level of nesting only. Enforced here, not just hidden in the UI — the
    // same posture as the core-section delete guard below. The rule itself
    // lives in `canNest` so it can be tested directly.
    if (!canNest(parent ?? null, type)) return;
  }

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${pageSections.position}), -1)` })
    .from(pageSections)
    .where(parentId ? eq(pageSections.parentId, parentId) : and(scopeWhere(scope), isNull(pageSections.parentId)));

  await db.insert(pageSections).values({
    page: scope.page,
    pageId: scope.pageId ?? null,
    postId: scope.postId ?? null,
    parentId,
    type,
    position: Number(max) + 1,
    isVisible: true,
    config: meta.defaultConfig,
    layout: meta.defaultLayout ?? {},
  });

  revalidateScope(scope);
}

export async function deleteSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [row] = await db.select({ type: pageSections.type }).from(pageSections).where(eq(pageSections.id, id)).limit(1);
  if (!row) return;

  // A non-repeatable block is seeded once by migration and has nothing to
  // re-add it with, so deleting one would be unrecoverable through the UI.
  // Enforced here, not just hidden.
  if (!blockMeta(row.type)?.repeatable) return;

  // Children go with the parent via ON DELETE CASCADE at the database level;
  // this only removes the parent row.
  await db.delete(pageSections).where(eq(pageSections.id, id));
  revalidateScope(scopeFrom(formData));
}

/** Duplicates a block, including its children. Repeatable types only, for the same reason delete is. */
export async function duplicateSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [row] = await db.select().from(pageSections).where(eq(pageSections.id, id)).limit(1);
  if (!row || !blockMeta(row.type)?.repeatable) return;

  await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(pageSections)
      .values({
        page: row.page,
        pageId: row.pageId,
        postId: row.postId,
        parentId: row.parentId,
        type: row.type,
        position: row.position + 1,
        isVisible: row.isVisible,
        config: row.config,
        layout: row.layout,
      })
      .returning({ id: pageSections.id });

    const children = await tx.select().from(pageSections).where(eq(pageSections.parentId, row.id)).orderBy(asc(pageSections.position));
    if (children.length > 0) {
      await tx.insert(pageSections).values(
        children.map((child) => ({
          page: child.page,
          pageId: child.pageId,
          postId: child.postId,
          parentId: copy.id,
          type: child.type,
          position: child.position,
          isVisible: child.isVisible,
          config: child.config,
          layout: child.layout,
        })),
      );
    }
  });

  revalidateScope(scopeFrom(formData));
}

/** Used by the pages/posts builders to clear a scope's blocks when switching back to markdown. */
export async function deleteBlocksForScope(ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(pageSections).where(inArray(pageSections.id, ids));
}

/**
 * Switches a CMS page or blog post between its markdown field and the block
 * builder.
 *
 * Non-destructive in both directions: `content` is never touched, so switching
 * to blocks and back restores the original text exactly. The renderer also
 * falls back to `content` when a page is set to blocks but has none yet, so
 * flipping this can never leave a visitor looking at a blank page.
 */
export async function setPageBuilderAction(formData: FormData) {
  await requireAdmin();
  const pageId = z.coerce.number().int().positive().parse(formData.get('pageId'));
  const useBuilder = formData.get('useBuilder') === 'true';

  await db.update(pages).set({ useBuilder, updatedAt: new Date() }).where(eq(pages.id, pageId));

  revalidatePath('/', 'layout');
  revalidatePath(`/admin/pages/${pageId}/builder`);
}

export async function setPostBuilderAction(formData: FormData) {
  await requireAdmin();
  const postId = z.coerce.number().int().positive().parse(formData.get('postId'));
  const useBuilder = formData.get('useBuilder') === 'true';

  await db.update(posts).set({ useBuilder, updatedAt: new Date() }).where(eq(posts.id, postId));

  revalidatePath('/', 'layout');
  revalidatePath(`/admin/posts/${postId}/builder`);
}
