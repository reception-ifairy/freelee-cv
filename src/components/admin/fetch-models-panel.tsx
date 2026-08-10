'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { fetchProviderModelsAction, importFetchedModelsAction, type FetchModelsState } from '@/server/actions/admin-ai-models';
import type { ActionState } from '@/server/actions/auth';
import { CardCheckboxGrid } from '@/components/ui/card-checkbox-grid';
import { FormMessage } from '@/components/ui/field';

function FetchButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <RefreshCw className={pending ? 'size-3.5 animate-spin' : 'size-3.5'} />
      {pending ? 'Fetching…' : 'Fetch models'}
    </button>
  );
}

function ImportButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? 'Importing…' : 'Import selected'}
    </button>
  );
}

/**
 * Live "what models does this provider actually have right now" — never a
 * hand-typed, one-time list. Fetch, then pick which ones to bring into the
 * catalog (imported as `status: 'preview'`, priced/vetted afterward via the
 * existing per-model edit row). See docs/10-ai-model-registry.md.
 */
export function FetchModelsPanel({ providerId }: { providerId: number }) {
  const [fetchState, fetchAction] = useActionState<FetchModelsState, FormData>(fetchProviderModelsAction, null);
  const [importState, importAction] = useActionState<ActionState, FormData>(importFetchedModelsAction, null);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
      <form action={fetchAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="providerId" value={providerId} />
        <FetchButton />
        {fetchState?.error ? <span className="text-xs text-rose-500">{fetchState.error}</span> : null}
        {fetchState?.success ? <span className="text-xs text-emerald-600 dark:text-emerald-400">{fetchState.success}</span> : null}
      </form>

      {fetchState?.models && fetchState.models.length > 0 ? (
        <form action={importAction} className="space-y-3">
          <input type="hidden" name="providerId" value={providerId} />
          <FormMessage state={importState} />
          <CardCheckboxGrid
            name="modelId"
            columns={3}
            values={selected}
            onChange={setSelected}
            items={fetchState.models.map((m) => ({
              id: m.id,
              label: m.label,
              meta: `${m.id} · ${m.modality}`,
              hint: m.alreadyAdded ? 'Already in catalog' : undefined,
              disabled: m.alreadyAdded,
            }))}
          />
          <ImportButton disabled={selected.length === 0} />
        </form>
      ) : null}
    </div>
  );
}
