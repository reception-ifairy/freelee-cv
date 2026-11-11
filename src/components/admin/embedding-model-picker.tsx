'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { saveEmbeddingModelAction } from '@/server/actions/admin-ai-models';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { GridSelect, type GridSelectOption } from '@/components/ui/grid-select';
import { Hint, FormMessage } from '@/components/ui/field';

/**
 * The model the Knowledgebase embeds with — `library_embedding_model`.
 *
 * The Knowledgebase page has always said "choose one under Settings", and
 * there was nothing to choose with: the setting could only be written in the
 * database. Saves on change, like the model rows below it.
 */
export function EmbeddingModelPicker({
  options,
  value,
  activeId,
}: {
  /** Stable embedding models on providers that can run them, in the order `findEmbeddingModel()` tries them. */
  options: GridSelectOption[];
  /** The saved preference; '' means automatic. */
  value: string;
  /** What the Knowledgebase actually uses right now, after falling back. */
  activeId: string | null;
}) {
  const [selected, setSelected] = useState(value);
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    setSelected(next);
    setState(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('modelId', next);
      setState(await saveEmbeddingModelAction(null, formData));
    });
  }

  // A preference whose row was later retired or deleted: the embedder quietly
  // falls back, so say so instead of showing a choice that is not in effect.
  const stale = value !== '' && !options.some((option) => option.id === value);

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="font-semibold">Knowledgebase embedding model</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Turns documents into something bots can search. Changing it means every document must be processed
          again — results from two models do not mix.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          No Stable embedding model yet. Fetch OpenAI&apos;s models under Providers &amp; keys, then mark{' '}
          <code className="font-mono">text-embedding-3-small</code> Stable below.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-full max-w-sm">
            <GridSelect
              options={[{ id: '', label: 'Automatic', meta: options[0]?.id }, ...options]}
              value={stale ? '' : selected}
              onChange={choose}
              columns={2}
            />
          </div>
          {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" /> : null}
        </div>
      )}

      {stale ? (
        <Hint className="text-amber-700 dark:text-amber-300">
          The saved choice, <code className="font-mono">{value}</code>, is no longer Stable — using{' '}
          {activeId ? <code className="font-mono">{activeId}</code> : 'nothing'} instead.
        </Hint>
      ) : null}
      <Hint>
        It must give 1,536 numbers per passage: <code className="font-mono">text-embedding-3-small</code> does,{' '}
        <code className="font-mono">text-embedding-3-large</code> does not fit this database.
      </Hint>
      <FormMessage state={state} />
    </Card>
  );
}
