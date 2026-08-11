'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Eye, EyeOff, LayoutGrid, Loader2, Pencil, Trash2 } from 'lucide-react';
import { blockMeta } from '@/lib/blocks/catalog';
import {
  deleteSectionAction, duplicateSectionAction, moveSectionAction, toggleSectionAction,
} from '@/server/actions/admin-frontpage';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { ActionMenu } from '@/components/ui/action-menu';
import { BlockQuickEdit } from './block-quick-edit';
import type { EditableBlock, EditScope } from './editor-types';

/**
 * Admin controls drawn on the block itself, on the real page.
 *
 * Dormant until layout mode is switched on — the CSS in globals.css keeps
 * `.block-chrome` invisible and non-interactive otherwise, so an admin browsing
 * the site normally sees the site, not a scaffold. That is the detail that
 * makes on-page editing usable rather than annoying.
 *
 * Rendered only when the server has already established the viewer is an admin;
 * a visitor never receives this component at all.
 */
export function BlockChrome({
  block,
  scope,
  isFirst,
  isLast,
}: {
  block: EditableBlock;
  scope: EditScope;
  isFirst: boolean;
  isLast: boolean;
}) {
  const meta = blockMeta(block.type);
  const { run, pending } = useAdminAction();
  const [editing, setEditing] = useState<null | 'content' | 'layout'>(null);

  if (!meta) return null;

  const scoped = (fields: Record<string, string | number>) => ({
    ...fields,
    page: scope.page,
    ...(scope.pageId ? { pageId: scope.pageId } : {}),
    ...(scope.postId ? { postId: scope.postId } : {}),
  });

  return (
    <>
      <div className="block-chrome absolute left-3 top-3 z-40 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-brand shadow-lg">
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          {meta.label}
          {!block.isVisible ? <span className="opacity-80">· hidden</span> : null}
        </span>

        <button
          type="button"
          onClick={() => setEditing('content')}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-lg backdrop-blur hover:bg-brand-50 dark:border-brand-500/40 dark:bg-slate-900/95 dark:text-brand-300"
        >
          <Pencil className="size-3" /> Edit
        </button>

        <ActionMenu
          align="left"
          label={`${meta.label} actions`}
          items={[
            { label: 'Edit content', icon: <Pencil className="size-4" />, onSelect: () => setEditing('content') },
            { label: 'Layout & grid', icon: <LayoutGrid className="size-4" />, onSelect: () => setEditing('layout') },
            {
              label: 'Move up', icon: <ChevronDown className="size-4 rotate-180" />, separated: true, disabled: isFirst,
              onSelect: () => run(moveSectionAction, scoped({ id: block.id, direction: 'up' })),
            },
            {
              label: 'Move down', icon: <ChevronDown className="size-4" />, disabled: isLast,
              onSelect: () => run(moveSectionAction, scoped({ id: block.id, direction: 'down' })),
            },
            {
              label: block.isVisible ? 'Hide from the page' : 'Show on the page', separated: true,
              icon: block.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />,
              onSelect: () => run(toggleSectionAction, scoped({ id: block.id, isVisible: String(block.isVisible) })),
            },
            {
              label: 'Duplicate', icon: <Copy className="size-4" />, disabled: !meta.repeatable,
              onSelect: () => run(duplicateSectionAction, scoped({ id: block.id })),
            },
            {
              label: 'Delete', icon: <Trash2 className="size-4" />, danger: true, separated: true, disabled: !meta.repeatable,
              onSelect: () => run(deleteSectionAction, scoped({ id: block.id })),
            },
          ]}
        />
      </div>

      {editing ? (
        <BlockQuickEdit
          blockId={block.id}
          type={block.type}
          config={block.config}
          layout={block.layout}
          scope={scope}
          open
          initialTab={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
