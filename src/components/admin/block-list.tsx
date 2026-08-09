'use client';

import { useState, useTransition } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  createSectionAction, deleteSectionAction, duplicateSectionAction,
  moveSectionAction, reorderSectionsAction, toggleSectionAction,
} from '@/server/actions/admin-frontpage';
import { BLOCK_CATALOG, BLOCK_GROUP_LABELS, blockMeta, type BlockMeta } from '@/lib/blocks/catalog';
import { BlockCard, type BlockCardRow } from './block-card';
import { BlockIcon } from '@/components/ui/block-icon';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BlockScopeProps = { page: string; pageId?: number; postId?: number };

/**
 * The builder's ordered list.
 *
 * Drag-and-drop uses @dnd-kit rather than hand-rolled HTML5 drag events, which
 * is the one place on this project a UI dependency earned its keep: keyboard
 * reordering (Tab to the grip, Space to lift, arrows to move, Space to drop)
 * and screen-reader announcements come with it, and are genuinely hard to get
 * right by hand. The up/down buttons remain as a plain, no-JavaScript fallback.
 *
 * The whole order is persisted in one request on drop, rather than a request
 * per nudge as the old arrow-only editor did.
 */
/** Identity of the server's data, so local state resets only when it actually changed — not on every re-render. */
function signatureOf(rows: BlockCardRow[]): string {
  return rows.map((r) => `${r.id}:${r.type}:${r.isVisible}:${r.parentId ?? ''}`).join('|');
}

export function BlockList({ rows, scope }: { rows: BlockCardRow[]; scope: BlockScopeProps }) {
  const topLevel = rows.filter((r) => r.parentId == null);

  const childrenByParent = new Map<number, BlockCardRow[]>();
  for (const row of rows) {
    if (row.parentId == null) continue;
    childrenByParent.set(row.parentId, [...(childrenByParent.get(row.parentId) ?? []), row]);
  }

  // Local state so a drag moves the card immediately instead of after a
  // round-trip — but the server is the source of truth, so it is resynced
  // whenever the server sends different data.
  //
  // This resync is not optional: `useState(rows)` only reads its argument on
  // mount, so without it, adding a block wrote the row and revalidated the
  // route while the list on screen never changed. Adjusting state during
  // render (rather than in an effect) is React's documented pattern for
  // "derive from props but keep local edits" and avoids a second paint.
  const [items, setItems] = useState(topLevel);
  const [signature, setSignature] = useState(() => signatureOf(topLevel));
  const incoming = signatureOf(topLevel);
  if (incoming !== signature) {
    setSignature(incoming);
    setItems(topLevel);
  }

  const [, startTransition] = useTransition();
  const optimistic = items;

  const sensors = useSensors(
    // A small distance threshold so a click on a button inside the card is not
    // swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function scopeFields(formData: FormData) {
    formData.set('page', scope.page);
    if (scope.pageId) formData.set('pageId', String(scope.pageId));
    if (scope.postId) formData.set('postId', String(scope.postId));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimistic.findIndex((r) => r.id === active.id);
    const newIndex = optimistic.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(optimistic, oldIndex, newIndex);
    setItems(next);
    setSignature(signatureOf(next));

    startTransition(async () => {
      const formData = new FormData();
      formData.set('order', JSON.stringify(next.map((r) => r.id)));
      scopeFields(formData);
      await reorderSectionsAction(formData);
    });
  }

  function run(action: (fd: FormData) => Promise<unknown>, fields: Record<string, string>) {
    startTransition(async () => {
      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) formData.set(k, v);
      scopeFields(formData);
      await action(formData);
    });
  }

  const usedTypes = new Set(optimistic.map((r) => r.type));

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={optimistic.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {optimistic.map((row, index) => (
              <BlockCard
                key={row.id}
                row={row}
                scope={scope}
                isFirst={index === 0}
                isLast={index === optimistic.length - 1}
                onMove={(id, direction) => run(moveSectionAction, { id: String(id), direction })}
                onToggle={(id, isVisible) => {
                  setItems((current) => current.map((r) => (r.id === id ? { ...r, isVisible: !isVisible } : r)));
                  run(toggleSectionAction, { id: String(id), isVisible: String(isVisible) });
                }}
                onDelete={(id) => {
                  setItems((current) => current.filter((r) => r.id !== id));
                  run(deleteSectionAction, { id: String(id) });
                }}
                onDuplicate={(id) => run(duplicateSectionAction, { id: String(id) })}
                childRows={childrenByParent.get(row.id) ?? []}
                scopeFields={scopeFields}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {optimistic.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No blocks yet. Add one below to start building this page.
        </p>
      ) : null}

      <AddBlock usedTypes={usedTypes} onAdd={(type) => run(createSectionAction, { type })} />
    </div>
  );
}

/** Grouped picker. Non-repeatable blocks already on the page are shown as used rather than hidden, so it is obvious why they cannot be added twice. */
function AddBlock({ usedTypes, onAdd }: { usedTypes: Set<string>; onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  const groups = (['content', 'marketing', 'data', 'layout'] as const)
    .map((group) => ({ group, blocks: BLOCK_CATALOG.filter((b) => b.group === group) }))
    .filter((g) => g.blocks.length > 0);

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-300"
      >
        <Plus className="size-4" /> Add a block
      </button>

      {open ? (
        <div className="space-y-5 border-t border-slate-200 p-4 dark:border-slate-700">
          {groups.map(({ group, blocks }) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{BLOCK_GROUP_LABELS[group]}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {blocks.map((meta) => (
                  <BlockOption
                    key={meta.key}
                    meta={meta}
                    used={!meta.repeatable && usedTypes.has(meta.key)}
                    onAdd={() => {
                      onAdd(meta.key);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BlockOption({ meta, used, onAdd }: { meta: BlockMeta; used: boolean; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={used}
      title={used ? `${meta.label} is already on this page and can only appear once.` : undefined}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-left transition',
        used
          ? 'cursor-not-allowed border-slate-200 opacity-50 dark:border-slate-700'
          : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:bg-brand-500/5',
      )}
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
        <BlockIcon name={meta.icon} className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{meta.label}</span>
        <span className="block text-xs text-slate-400">{used ? 'Already on this page' : meta.description}</span>
      </span>
    </button>
  );
}

export { blockMeta };
