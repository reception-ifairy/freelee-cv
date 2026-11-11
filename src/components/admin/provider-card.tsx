'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, FlaskConical, Loader2, Plus } from 'lucide-react';
import { updateAiProviderAction } from '@/server/actions/admin-ai-models';
import { ModelRow, type ModelRowData } from './model-row';
import { GridSelect } from '@/components/ui/grid-select';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ProviderCardData = {
  id: number;
  key: string;
  label: string;
  apiKeyEnv: string;
  defaultModel: string;
  isActive: boolean;
  hasKey: boolean;
  supportsImages: boolean;
  isImageOnly: boolean;
  /** Local models: free to run, slow, and for experimenting rather than serving customers. */
  isLocal: boolean;
};

/**
 * One provider, with its models.
 *
 * The default model is a **dropdown of the models actually registered** for
 * this provider, not a free-text box. Typing an id that does not exist there
 * was silent — every chat then failed at request time with the provider's own
 * error, which is a poor place to learn about a typo.
 *
 * Test and Fetch used to sit at the bottom of this card. They moved to the
 * provider's connection card in Providers & keys, next to the key they check:
 * this card is now only about which models are offered and at what price.
 */
export function ProviderCard({
  provider,
  chatModels,
  imageModels,
  embeddingModels,
  previewModels,
  onAddModel,
}: {
  provider: ProviderCardData;
  /** Not preview — those have their own collapsed group below. */
  chatModels: ModelRowData[];
  imageModels: ModelRowData[];
  embeddingModels: ModelRowData[];
  previewModels: ModelRowData[];
  onAddModel: () => void;
}) {
  const [defaultModel, setDefaultModel] = useState(provider.defaultModel);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Preview models are left out on purpose: the default model is used by
  // every bot without a model of its own, so picking an unvetted one would
  // offer it to customers through the back door. The current default stays
  // listed whatever its status, so the control never shows an empty value.
  const options = [...chatModels, ...previewModels.filter((model) => model.modelId === provider.defaultModel)]
    .filter((model) => model.modality === 'text' && (model.status !== 'retired' || model.modelId === provider.defaultModel))
    .map((model) => ({ id: model.modelId, label: model.modelId, meta: model.label }));

  function saveDefault(next: string) {
    setDefaultModel(next);
    setSaving(true);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', String(provider.id));
      formData.set('isActive', String(provider.isActive));
      formData.set('defaultModel', next);
      await updateAiProviderAction(formData);
      setSaving(false);
    });
  }

  return (
    <Card className="overflow-visible">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{provider.label}</h3>
            {/* "key set" is the least informative always-visible signal there
                is — a key that authenticates is not an account that can pay,
                which is exactly what the no-credit health state exists to
                catch. Phrased as "key present" so it stops implying "working". */}
            {provider.hasKey ? <Badge tone="green">key present</Badge> : <Badge tone="amber">no key</Badge>}
            {/* isActive was in the data and submitted back on every save, but
                rendered nowhere — a disabled provider looked identical to a
                live one. */}
            {!provider.isActive ? <Badge tone="slate">disabled</Badge> : null}
            {provider.isLocal ? (
              <Badge tone="brand">
                <FlaskConical className="size-3" /> R&amp;D only
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {chatModels.length} chat {chatModels.length === 1 ? 'model' : 'models'}
            {provider.supportsImages ? ` · ${imageModels.length} image` : ''}
            {embeddingModels.length > 0 ? ` · ${embeddingModels.length} embedding` : ''}
            {previewModels.length > 0 ? ` · ${previewModels.length} preview` : ''}
          </p>
        </div>

        {!provider.isImageOnly ? (
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="w-full sm:w-52">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Default model</span>
                <HelpTip
                  title="Default model"
                  body="Used whenever a persona on this provider has no model or tier of its own. Only models registered below can be chosen, so a typo cannot leave every chat failing at request time."
                />
              </div>
              {options.length > 0 ? (
                <GridSelect options={options} value={defaultModel} onChange={saveDefault} columns={2} placeholder="Pick a model" />
              ) : (
                <p className="text-xs text-slate-400">Register a model first.</p>
              )}
            </div>
            {saving ? <Loader2 className="mb-3 size-4 animate-spin text-slate-400" /> : null}
          </div>
        ) : null}
      </div>

      {provider.isLocal ? (
        <div className="border-b border-slate-100 bg-brand-50/40 p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-brand-500/5">
          <p className="font-semibold">For experiments, not for customers.</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            These models run on this server through Ollama. They cost nothing per message and never leave the
            box, which makes them ideal for testing prompts, tools and new features — and for research where
            sending data to a third party is the wrong answer.
          </p>
          <p className="mt-1.5 text-slate-600 dark:text-slate-300">
            They are also <strong>much slower and much weaker</strong> than a hosted model: measured here at
            roughly 9 tokens/second on the 1B model and under 2 on the 3B, CPU-only. Assign one to a persona
            customers use and the experience will be poor. Keep them on internal personas, and use{' '}
            <code className="font-mono">ollama pull</code> on the server to add more.
          </p>
        </div>
      ) : null}

      <div className="space-y-4 p-4">
        {!provider.isImageOnly ? (
          <Section
            title="Chat models"
            empty="No chat models yet — Fetch models under Providers & keys, then mark the ones you want Stable."
            models={chatModels}
          />
        ) : null}

        {/* Also when the provider row does not claim image support but has
            image models anyway (a Gemini image model fetched and marked
            Stable) — otherwise a Stable row would be invisible here. */}
        {provider.supportsImages || imageModels.length > 0 ? (
          <Section
            title="Image models"
            empty="No image models yet — Fetch models under Providers & keys, then mark one Stable."
            models={imageModels}
          />
        ) : null}

        {/* Only when there are some: most providers have no embedding API
            this platform can use, and an empty heading on each would suggest
            otherwise. */}
        {embeddingModels.length > 0 ? (
          <Section title="Embedding models" empty="" models={embeddingModels} />
        ) : null}

        <PreviewGroup models={previewModels} />

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onAddModel}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="size-3.5" /> Add manually
          </button>
        </div>
      </div>
    </Card>
  );
}

function Section({ title, empty, models }: { title: string; empty: string; models: ModelRowData[] }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      {models.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {models.map((model) => (
            <ModelRow key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Everything fetched from the provider that nobody has vetted yet.
 *
 * Collapsed, and its rows only rendered when opened: one Fetch on OpenRouter
 * adds a few hundred models, and listing them inline buried the handful that
 * customers can actually use. A preview model is never offered — the registry
 * reads Stable rows only — so this is a to-do list, not a catalogue.
 */
function PreviewGroup({ models }: { models: ModelRowData[] }) {
  const [open, setOpen] = useState(false);
  if (models.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {models.length} preview {models.length === 1 ? 'model' : 'models'} (not offered to customers)
          </span>
          <span className="block text-xs text-slate-400">
            Fetched from the provider, not vetted yet. Set a price, then mark one Stable to offer it.
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-dashed border-slate-200 p-3 dark:border-slate-700">
          {models.map((model) => (
            <ModelRow key={model.id} model={model} showModality />
          ))}
        </div>
      ) : null}
    </div>
  );
}
