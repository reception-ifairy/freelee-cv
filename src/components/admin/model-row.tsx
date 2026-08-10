'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { updateAiModelAction } from '@/server/actions/admin-ai-models';
import { GridSelect } from '@/components/ui/grid-select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ModelRowData = {
  id: number;
  modelId: string;
  label: string;
  tier: string | null;
  status: 'preview' | 'stable' | 'deprecated' | 'retired';
  creditsPer1k: number;
  sort: number;
  isDefault: boolean;
};

const TIERS = [
  { id: '', label: 'No tier' },
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'advanced', label: 'Advanced' },
];

const STATUSES = [
  { id: 'stable', label: 'Stable' },
  { id: 'preview', label: 'Preview' },
  { id: 'deprecated', label: 'Deprecated' },
  { id: 'retired', label: 'Retired' },
];

const STATUS_TONE = { stable: 'green', preview: 'brand', deprecated: 'amber', retired: 'slate' } as const;

/**
 * One model, as a row of real dropdowns.
 *
 * The previous version crammed two native `<select>`s and two number inputs
 * onto one line at `h-8 w-32 text-xs`, then asked you to find the word "Save"
 * at the end of it. Ten models made ten of those. Here the controls are the
 * same `GridSelect` used everywhere else, and saving is automatic on change —
 * there is nothing to submit and nothing to forget.
 */
export function ModelRow({ model, disabled }: { model: ModelRowData; disabled?: boolean }) {
  const [tier, setTier] = useState(model.tier ?? '');
  const [status, setStatus] = useState(model.status);
  const [credits, setCredits] = useState(String(model.creditsPer1k));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: Partial<{ tier: string; status: string; creditsPer1k: string }>) {
    const formData = new FormData();
    formData.set('id', String(model.id));
    formData.set('tier', next.tier ?? tier);
    formData.set('status', next.status ?? status);
    formData.set('creditsPer1k', next.creditsPer1k ?? credits);
    formData.set('sort', String(model.sort));

    startTransition(async () => {
      await updateAiModelAction(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div
      className={cn(
        'grid items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700',
        'sm:grid-cols-[minmax(0,1fr)_9rem_9rem_7rem_auto]',
        model.status === 'retired' && 'opacity-50',
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-mono text-sm">
          {model.modelId}
          {model.isDefault ? <Badge tone="brand">default</Badge> : null}
        </p>
        <p className="truncate text-xs text-slate-400">{model.label}</p>
      </div>

      <GridSelect
        options={TIERS}
        value={tier}
        onChange={(value) => {
          setTier(value);
          save({ tier: value });
        }}
        columns={2}
        placeholder="Tier"
      />

      <GridSelect
        options={STATUSES}
        value={status}
        onChange={(value) => {
          setStatus(value as ModelRowData['status']);
          save({ status: value });
        }}
        columns={2}
      />

      <label className="flex items-center gap-1.5">
        <span className="sr-only">Credits per 1k tokens</span>
        <input
          type="number"
          min={0}
          value={credits}
          disabled={disabled}
          onChange={(event) => setCredits(event.target.value)}
          onBlur={() => save({ creditsPer1k: credits })}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
          title="Credits per 1,000 tokens"
        />
        <span className="whitespace-nowrap text-[10px] text-slate-400">/1k</span>
      </label>

      <span className="flex w-16 items-center justify-end gap-1.5">
        {pending ? <Loader2 className="size-4 animate-spin text-slate-400" /> : null}
        {saved && !pending ? <Check className="size-4 text-emerald-500" /> : null}
        {!pending && !saved ? <Badge tone={STATUS_TONE[status]}>{status}</Badge> : null}
      </span>
    </div>
  );
}
