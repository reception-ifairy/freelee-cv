'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createAiModelAction } from '@/server/actions/admin-ai-models';
import type { ActionState } from '@/server/actions/auth';
import { ProviderCard, type ProviderCardData } from './provider-card';
import type { ModelRowData } from './model-row';
import { Modal } from '@/components/ui/modal';
import { GridSelect } from '@/components/ui/grid-select';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';

export type ProviderBundle = {
  provider: ProviderCardData;
  chatModels: ModelRowData[];
  imageModels: ModelRowData[];
};

/**
 * The whole model catalog, one card per provider.
 *
 * Replaces a page where "Add a model" sat at the very bottom under every
 * provider — so adding an OpenAI model meant scrolling past Anthropic, Google,
 * Ollama and Stability, then choosing OpenAI again from a dropdown. It is now a
 * dialog opened from the provider it belongs to, with that provider already
 * chosen.
 */
export function ModelsManager({
  bundles,
  fetchPanels,
}: {
  bundles: ProviderBundle[];
  /** Rendered on the server (they hold their own server actions), keyed by provider key. */
  fetchPanels: Record<string, React.ReactNode>;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {bundles.map(({ provider, chatModels, imageModels }) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          chatModels={chatModels}
          imageModels={imageModels}
          fetchPanel={fetchPanels[provider.key] ?? null}
          onAddModel={() => setAdding(String(provider.id))}
        />
      ))}

      <AddModelDialog
        open={adding !== null}
        providerKey={adding}
        providers={bundles.map((b) => ({ id: String(b.provider.id), label: b.provider.label }))}
        onClose={() => setAdding(null)}
      />
    </div>
  );
}

function AddModelDialog({
  open, providerKey, providers, onClose,
}: {
  open: boolean;
  providerKey: string | null;
  providers: { id: string; label: string }[];
  onClose: () => void;
}) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState(providerKey ?? providers[0]?.id ?? '');
  const [modality, setModality] = useState('text');
  const [tier, setTier] = useState('');
  const [modelId, setModelId] = useState('');
  const [label, setLabel] = useState('');
  const [credits, setCredits] = useState('5');

  // The dialog is opened from a specific provider, so honour that choice when
  // it changes rather than keeping whatever was picked last time.
  const [seen, setSeen] = useState(providerKey);
  if (providerKey !== seen) {
    setSeen(providerKey);
    if (providerKey) setProvider(providerKey);
    setState(null);
  }

  function submit() {
    const formData = new FormData();
    formData.set('providerId', provider);
    formData.set('modelId', modelId.trim());
    formData.set('label', label.trim() || modelId.trim());
    formData.set('modality', modality);
    formData.set('tier', tier);
    formData.set('creditsPer1k', credits);

    startTransition(async () => {
      const result = await createAiModelAction(null, formData);
      setState(result);
      if (result?.success) {
        setModelId('');
        setLabel('');
        onClose();
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a model"
      subtitle="For a model the provider's catalog does not list — a preview, a fine-tune, or a local build."
      eyebrow={providers.find((p) => p.id === provider)?.label}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || modelId.trim().length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="size-4" /> {pending ? 'Adding…' : 'Add model'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormMessage state={state} />

        <div>
          <Label>Provider</Label>
          <GridSelect options={providers} value={provider} onChange={setProvider} columns={3} />
        </div>

        <div>
          <Label htmlFor="add-model-id">Model id *</Label>
          <Input
            id="add-model-id"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder="gpt-4.1-mini"
            className="font-mono text-sm"
          />
          <Hint>The exact string the provider's API expects. A typo here fails at request time, not now.</Hint>
        </div>

        <div>
          <Label htmlFor="add-model-label">Display label</Label>
          <Input
            id="add-model-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Defaults to the model id"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Used for</Label>
            <GridSelect
              options={[
                { id: 'text', label: 'Chat / text' },
                { id: 'image', label: 'Image generation' },
              ]}
              value={modality}
              onChange={setModality}
              columns={2}
            />
          </div>
          <div>
            <Label>Tier</Label>
            <GridSelect
              options={[
                { id: '', label: 'No tier' },
                { id: 'fast', label: 'Fast' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'advanced', label: 'Advanced' },
              ]}
              value={tier}
              onChange={setTier}
              columns={2}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="add-model-credits">Credits per 1,000 tokens</Label>
          <Input
            id="add-model-credits"
            type="number"
            min={0}
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
          />
          <Hint>What a customer is charged. Set it from the provider's price list plus your margin.</Hint>
        </div>
      </div>
    </Modal>
  );
}
