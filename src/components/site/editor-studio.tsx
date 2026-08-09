'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, Eye, EyeOff, GripVertical, LayoutPanelTop, Plus, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { BLOCK_CATALOG, BLOCK_GROUP_LABELS, blockMeta, type BlockMeta } from '@/lib/blocks/catalog';
import { createSectionAction, reorderSectionsAction, toggleSectionAction } from '@/server/actions/admin-frontpage';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { BlockIcon } from '@/components/ui/block-icon';
import { Modal } from '@/components/ui/modal';
import { BLOCK_ANCHOR_ATTR, type EditableBlock, type EditScope } from './editor-types';
import { cn } from '@/lib/utils';

/**
 * The page builder, rendered on the live page for admins.
 *
 * Ported from the approach on ifairy.co.uk, which gets one thing importantly
 * right: you arrange the page **against the real design**, not against an
 * abstract list in a separate screen. Two additions over that version — this
 * one works on any scope (home, a CMS page, a blog post) rather than a single
 * landing page, and reordering is keyboard-accessible.
 *
 * Layout mode is a CSS flag on <html>, so switching it off restores the real
 * site instantly with no re-render.
 */
export function EditorStudio({
  blocks,
  scope,
  adminHref,
}: {
  blocks: EditableBlock[];
  scope: EditScope;
  adminHref: string;
}) {
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState(blocks);
  const [snapshot, setSnapshot] = useState(blocks);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { run } = useAdminAction();

  // Resync when the server sends different data — React's adjust-during-render
  // pattern, the same one the admin block list uses.
  if (snapshot !== blocks) {
    setSnapshot(blocks);
    setItems(blocks);
  }

  // The flag lives on <html> so plain CSS can reveal every piece of chrome at
  // once; nothing re-renders when it flips.
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.layoutMode = 'on';
    else delete root.dataset.layoutMode;
    return () => {
      delete root.dataset.layoutMode;
    };
  }, [active]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function scopeFields(formData: FormData) {
    formData.set('page', scope.page);
    if (scope.pageId) formData.set('pageId', String(scope.pageId));
    if (scope.postId) formData.set('postId', String(scope.postId));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const from = items.findIndex((b) => b.id === dragged.id);
    const to = items.findIndex((b) => b.id === over.id);
    if (from === -1 || to === -1) return;

    const previous = items;
    const next = arrayMove(items, from, to);
    setItems(next);
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('order', JSON.stringify(next.map((b) => b.id)));
      scopeFields(formData);
      const result = await reorderSectionsAction(formData);
      // Roll back on failure rather than leaving the panel showing an order the
      // page does not have.
      if (result?.error) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  function jumpTo(id: number) {
    document.querySelector(`[${BLOCK_ANCHOR_ATTR}="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const usedTypes = new Set(items.map((b) => b.type));
  const hiddenCount = items.filter((b) => !b.isVisible).length;

  return (
    <>
      {/* Collapsed launcher — one small button, so the site stays the site. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[150] inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl hover:bg-brand-700"
        >
          <LayoutPanelTop className="size-4" /> Edit page
        </button>
      ) : (
        <aside className="fixed bottom-4 right-4 z-[150] flex max-h-[70vh] w-72 flex-col rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
            <LayoutPanelTop className="size-4 text-brand-600" />
            <p className="flex-1 text-sm font-bold">Page builder</p>
            <Link href={adminHref} className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Open the full editor" title="Open the full editor">
              <ExternalLink className="size-3.5" />
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the builder" className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="size-4" />
            </button>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-xs dark:border-slate-800">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <span className="flex-1 font-semibold">Layout mode</span>
            <Settings2 className="size-3.5 text-slate-400" />
          </label>
          <p className="border-b border-slate-100 px-3 pb-2.5 text-[11px] leading-snug text-slate-400 dark:border-slate-800">
            {active ? 'Controls are showing on each block.' : 'Turn on to show controls on each block.'}
            {hiddenCount > 0 ? ` ${hiddenCount} hidden block${hiddenCount === 1 ? '' : 's'} shown faded.` : ''}
          </p>

          {error ? <p className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}

          <div className="flex-1 overflow-y-auto p-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {items.map((block) => (
                    <StudioRow
                      key={block.id}
                      block={block}
                      onJump={() => jumpTo(block.id)}
                      onToggle={() =>
                        run(toggleSectionAction, {
                          id: block.id,
                          isVisible: String(block.isVisible),
                          page: scope.page,
                          ...(scope.pageId ? { pageId: scope.pageId } : {}),
                          ...(scope.postId ? { postId: scope.postId } : {}),
                        })
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {items.length === 0 ? <p className="px-2 py-6 text-center text-xs text-slate-400">No blocks yet.</p> : null}
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="m-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="size-3.5" /> Add a block
          </button>
        </aside>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a block" subtitle="It is added at the end of the page." width="xl">
        <div className="space-y-5">
          {(['content', 'marketing', 'data', 'layout'] as const).map((group) => {
            const options = BLOCK_CATALOG.filter((b) => b.group === group);
            if (options.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{BLOCK_GROUP_LABELS[group]}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {options.map((option) => (
                    <AddOption
                      key={option.key}
                      meta={option}
                      used={!option.repeatable && usedTypes.has(option.key)}
                      onAdd={() => {
                        run(createSectionAction, {
                          type: option.key,
                          page: scope.page,
                          ...(scope.pageId ? { pageId: scope.pageId } : {}),
                          ...(scope.postId ? { postId: scope.postId } : {}),
                        });
                        setAdding(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

function StudioRow({ block, onJump, onToggle }: { block: EditableBlock; onJump: () => void; onToggle: () => void }) {
  const meta = blockMeta(block.type);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-xs transition',
        isDragging ? 'border-brand-400 bg-white shadow dark:bg-slate-800' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800',
        !block.isVisible && 'opacity-50',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${meta?.label ?? block.type}`}
        className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600"
      >
        <GripVertical className="size-3.5" />
      </button>
      <BlockIcon name={meta?.icon} className="size-3.5 shrink-0 text-slate-400" />
      {/* Clicking the name scrolls the page to that block — the panel and the
          page stay tied together, which is what makes a long page workable. */}
      <button type="button" onClick={onJump} className="min-w-0 flex-1 truncate text-left font-medium">
        {meta?.label ?? block.type}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={block.isVisible ? 'Hide' : 'Show'}
        className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        {block.isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
    </li>
  );
}

function AddOption({ meta, used, onAdd }: { meta: BlockMeta; used: boolean; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={used}
      title={used ? `${meta.label} can only appear once and is already on this page.` : undefined}
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
