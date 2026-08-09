'use client';

import { useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown, Copy, Eye, EyeOff, GripVertical, LayoutGrid, Pencil, Plus, Trash2,
} from 'lucide-react';
import { BLOCK_CATALOG, blockMeta } from '@/lib/blocks/catalog';
import { resolveLayout, type BlockLayout } from '@/lib/blocks/layout';
import {
  createSectionAction, deleteSectionAction, moveSectionAction, saveBlockAction,
} from '@/server/actions/admin-frontpage';
import type { ActionState } from '@/server/actions/auth';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/ui/field';
import { BlockIcon } from '@/components/ui/block-icon';
import { BlockFields } from './block-fields';
import { BlockLayoutControls } from './block-layout-controls';
import { cn } from '@/lib/utils';

export type BlockCardRow = {
  id: number;
  type: string;
  isVisible: boolean;
  config: Record<string, unknown>;
  layout: unknown;
  parentId?: number | null;
};

type Tab = 'content' | 'layout';

/**
 * One block in the builder: drag handle, quick actions, and — when opened — its
 * schema-driven fields and the shared layout controls.
 *
 * Content and layout save together in one request. Splitting them would let an
 * admin change the width, walk away, and lose the text they had already typed.
 */
export function BlockCard({
  row,
  scope,
  onToggle,
  onDelete,
  onDuplicate,
  isFirst,
  isLast,
  onMove,
  childRows = [],
  scopeFields,
}: {
  row: BlockCardRow;
  scope: { page: string; pageId?: number; postId?: number };
  onToggle: (id: number, isVisible: boolean) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: number, direction: 'up' | 'down') => void;
  /** Only ever populated for a container block — nesting is capped at one level. */
  childRows?: BlockCardRow[];
  scopeFields?: (formData: FormData) => void;
}) {
  const meta = blockMeta(row.type);
  // `setNodeRef` marks the whole card as the sortable item; `setActivatorNodeRef`
  // marks the grip as the only thing that starts a drag. Without the split, the
  // entire card would be draggable and the inline text inputs would be
  // impossible to select with the mouse.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('content');
  const [config, setConfig] = useState<Record<string, unknown>>({ ...(meta?.defaultConfig ?? {}), ...row.config });
  const [layout, setLayout] = useState<BlockLayout>(resolveLayout({ ...(meta?.defaultLayout ?? {}), ...(row.layout as object) }));
  const [state, setState] = useState<ActionState>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const formData = new FormData();
    formData.set('id', String(row.id));
    formData.set('config', JSON.stringify(config));
    formData.set('layout', JSON.stringify(layout));
    formData.set('page', scope.page);
    if (scope.pageId) formData.set('pageId', String(scope.pageId));
    if (scope.postId) formData.set('postId', String(scope.postId));

    startTransition(async () => {
      const result = await saveBlockAction(null, formData);
      setState(result);
      if (result?.success) setDirty(false);
    });
  }

  if (!meta) {
    // A row whose type is no longer in the catalog. Shown rather than hidden so
    // it can be deleted, but never silently rendered on the public page.
    return (
      <div ref={setNodeRef} className="rounded-xl border border-dashed border-amber-300 p-4 text-sm text-amber-700 dark:text-amber-400">
        Unknown block type <code>{row.type}</code> — it will not render on the site.
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-2xl border bg-white shadow-sm dark:bg-slate-900',
        isDragging ? 'z-10 border-brand-400 shadow-lg' : 'border-slate-200 dark:border-slate-700',
        !row.isVisible && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${meta.label}`}
          className="cursor-grab touch-none rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:bg-slate-800"
        >
          <GripVertical className="size-5" />
        </button>

        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <BlockIcon name={meta.icon} className="size-4" />
        </span>

        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className="truncate font-semibold">{meta.label}</p>
          <p className="truncate text-xs text-slate-400">{meta.description}</p>
        </button>

        {dirty ? <Badge tone="amber">unsaved</Badge> : null}
        {!row.isVisible ? <Badge tone="slate">hidden</Badge> : null}
        {meta.dataDriven ? <Badge tone="slate">live data</Badge> : null}

        <div className="flex items-center gap-1">
          {/* Arrow buttons stay beside drag-and-drop: they work without
              JavaScript and are unambiguous when a list is long. */}
          <IconButton label="Move up" onClick={() => onMove(row.id, 'up')} disabled={isFirst}>
            <ChevronDown className="size-4 rotate-180" />
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove(row.id, 'down')} disabled={isLast}>
            <ChevronDown className="size-4" />
          </IconButton>
          <IconButton label={row.isVisible ? 'Hide' : 'Show'} onClick={() => onToggle(row.id, row.isVisible)}>
            {row.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconButton>
          {meta.repeatable ? (
            <>
              <IconButton label="Duplicate" onClick={() => onDuplicate(row.id)}>
                <Copy className="size-4" />
              </IconButton>
              <IconButton label="Delete" onClick={() => onDelete(row.id)} tone="danger">
                <Trash2 className="size-4" />
              </IconButton>
            </>
          ) : null}
        </div>
      </div>

      {meta.container ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <ContainerChildren parentId={row.id} rows={childRows} scopeFields={scopeFields} />
        </div>
      ) : null}

      {open ? (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-1 border-b border-slate-100 px-4 dark:border-slate-800">
            <TabButton active={tab === 'content'} onClick={() => setTab('content')} icon={<Pencil className="size-3.5" />}>
              Content
            </TabButton>
            <TabButton active={tab === 'layout'} onClick={() => setTab('layout')} icon={<LayoutGrid className="size-3.5" />}>
              Layout
            </TabButton>
          </div>

          <div className="space-y-4 p-4">
            <FormMessage state={state} />

            {tab === 'content' ? (
              <BlockFields
                fields={meta.fields}
                config={config}
                onChange={(next) => {
                  setConfig(next);
                  setDirty(true);
                }}
                idPrefix={`block-${row.id}`}
              />
            ) : (
              <BlockLayoutControls
                layout={layout}
                supportsColumns={meta.supportsColumns}
                onChange={(next) => {
                  setLayout(next);
                  setDirty(true);
                }}
              />
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={pending || !dirty}
                className="h-9 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save block'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label, onClick, disabled, tone, children,
}: {
  label: string; onClick: () => void; disabled?: boolean; tone?: 'danger'; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-8 place-items-center rounded-lg border border-slate-200 transition disabled:opacity-30 dark:border-slate-700',
        tone === 'danger'
          ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800',
      )}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
        active ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * The inside of a `columns` container.
 *
 * Deliberately simpler than the top-level list: children reorder with buttons
 * only, and the picker offers non-container blocks alone. Nesting is capped at
 * one level, so there is no recursion here — and the cap is enforced in the
 * server action too, since hiding it in the UI would not stop a crafted
 * request.
 */
function ContainerChildren({
  parentId,
  rows,
  scopeFields,
}: {
  parentId: number;
  rows: BlockCardRow[];
  scopeFields?: (formData: FormData) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function run(action: (fd: FormData) => Promise<unknown>, fields: Record<string, string>) {
    startTransition(async () => {
      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) formData.set(k, v);
      scopeFields?.(formData);
      await action(formData);
    });
  }

  const options = BLOCK_CATALOG.filter((b) => b.repeatable && !b.container);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Inside this container</p>

      {rows.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">Empty — add a block to fill the columns.</p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {rows.map((child, i) => (
            <li
              key={child.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-700"
            >
              <BlockIcon name={blockMeta(child.type)?.icon} className="size-3.5 text-slate-400" />
              <span className="flex-1 truncate">{blockMeta(child.type)?.label ?? child.type}</span>
              <button
                type="button"
                onClick={() => run(moveSectionAction, { id: String(child.id), direction: 'up' })}
                disabled={i === 0 || pending}
                aria-label="Move up"
                className="text-slate-400 disabled:opacity-30"
              >
                <ChevronDown className="size-3.5 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => run(moveSectionAction, { id: String(child.id), direction: 'down' })}
                disabled={i === rows.length - 1 || pending}
                aria-label="Move down"
                className="text-slate-400 disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => run(deleteSectionAction, { id: String(child.id) })}
                disabled={pending}
                aria-label="Remove from container"
                className="text-rose-400 hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                run(createSectionAction, { type: option.key, parentId: String(parentId) });
                setAdding(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-xs hover:border-brand-400 dark:border-slate-700"
            >
              <BlockIcon name={option.icon} className="size-3.5 text-slate-400" />
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus className="size-3.5" /> Add block inside
        </button>
      )}
    </div>
  );
}
