'use client';

import { useState, useTransition } from 'react';
import { LayoutGrid, Pencil } from 'lucide-react';
import { blockMeta } from '@/lib/blocks/catalog';
import { resolveLayout, type BlockLayout } from '@/lib/blocks/layout';
import { saveBlockAction } from '@/server/actions/admin-frontpage';
import type { ActionState } from '@/server/actions/auth';
import { BlockFields } from '@/components/admin/block-fields';
import { BlockLayoutControls } from '@/components/admin/block-layout-controls';
import { FormMessage } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { EditScope } from './editor-types';

/**
 * The block editor, opened over the live page.
 *
 * Deliberately the **same** `BlockFields` and `BlockLayoutControls` the admin
 * screen uses — one editing surface, two places to reach it. A parallel
 * "simple" editor would drift from the real one within a release.
 */
export function BlockQuickEdit({
  blockId,
  type,
  config: initialConfig,
  layout: initialLayout,
  scope,
  open,
  onClose,
  initialTab = 'content',
}: {
  blockId: number;
  type: string;
  config: Record<string, unknown>;
  layout: unknown;
  scope: EditScope;
  open: boolean;
  onClose: () => void;
  initialTab?: 'content' | 'layout';
}) {
  const meta = blockMeta(type);

  const [tab, setTab] = useState<'content' | 'layout'>(initialTab);
  const [config, setConfig] = useState<Record<string, unknown>>({ ...(meta?.defaultConfig ?? {}), ...initialConfig });
  const [layout, setLayout] = useState<BlockLayout>(resolveLayout({ ...(meta?.defaultLayout ?? {}), ...(initialLayout as object) }));
  const [state, setState] = useState<ActionState>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!meta) return null;

  function save({ andClose }: { andClose: boolean }) {
    const formData = new FormData();
    formData.set('id', String(blockId));
    formData.set('config', JSON.stringify(config));
    formData.set('layout', JSON.stringify(layout));
    formData.set('page', scope.page);
    if (scope.pageId) formData.set('pageId', String(scope.pageId));
    if (scope.postId) formData.set('postId', String(scope.postId));

    startTransition(async () => {
      const result = await saveBlockAction(null, formData);
      setState(result);
      if (!result?.success) return;
      setDirty(false);
      // The page behind is revalidated by the action, so closing shows the
      // change immediately — which is the whole point of editing in place.
      if (andClose) onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dirty={dirty}
      width="xl"
      eyebrow="Editing on the page"
      title={meta.label}
      subtitle={meta.description}
      footer={
        <>
          <button
            type="button"
            onClick={() => save({ andClose: false })}
            disabled={pending || !dirty}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => (dirty ? save({ andClose: true }) : onClose())}
            disabled={pending}
            className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand hover:bg-brand-700 disabled:opacity-50"
          >
            {dirty ? 'Save & close' : 'Close'}
          </button>
        </>
      }
    >
      <div className="mb-4 flex gap-1 border-b border-slate-100 dark:border-slate-800">
        <Tab active={tab === 'content'} onClick={() => setTab('content')} icon={<Pencil className="size-3.5" />}>
          Content
        </Tab>
        <Tab active={tab === 'layout'} onClick={() => setTab('layout')} icon={<LayoutGrid className="size-3.5" />}>
          Layout
        </Tab>
      </div>

      <FormMessage state={state} />

      <div className="mt-3">
        {tab === 'content' ? (
          <BlockFields
            fields={meta.fields}
            config={config}
            onChange={(next) => {
              setConfig(next);
              setDirty(true);
            }}
            idPrefix={`quick-${blockId}`}
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
      </div>
    </Modal>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
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
