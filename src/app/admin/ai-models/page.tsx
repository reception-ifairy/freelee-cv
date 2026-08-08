import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { aiProviders, aiModels } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Select, Hint } from '@/components/ui/field';
import { createAiModelAction, updateAiModelAction, updateAiProviderAction } from '@/server/actions/admin-ai-models';
import { ProviderField } from './provider-field';
import { FetchModelsPanel } from './fetch-models-panel';
import type { AiModelRow } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AI models' };

const STATUS_TONE = { stable: 'green', preview: 'brand', deprecated: 'amber', retired: 'slate' } as const;

function ModelRow({ model }: { model: AiModelRow }) {
  return (
    <form
      action={updateAiModelAction}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
    >
      <input type="hidden" name="id" value={model.id} />
      <div className="min-w-40 flex-1">
        <p className="font-mono text-sm">{model.modelId}</p>
        <p className="text-xs text-slate-400">{model.label}</p>
      </div>

      <Select name="tier" defaultValue={model.tier ?? ''} className="h-8 w-32 text-xs">
        <option value="">No tier</option>
        <option value="fast">Fast</option>
        <option value="balanced">Balanced</option>
        <option value="advanced">Advanced</option>
      </Select>

      <Select name="status" defaultValue={model.status} className="h-8 w-32 text-xs">
        <option value="preview">Preview</option>
        <option value="stable">Stable</option>
        <option value="deprecated">Deprecated</option>
        <option value="retired">Retired</option>
      </Select>

      <Input
        name="creditsPer1k"
        type="number"
        min={0}
        defaultValue={model.creditsPer1k}
        className="h-8 w-24 text-xs"
        title="Credits per 1k tokens"
      />

      <Input
        name="sort"
        type="number"
        defaultValue={model.sort}
        className="h-8 w-16 text-xs"
        title="Sort order"
      />

      <Badge tone={STATUS_TONE[model.status]}>{model.status}</Badge>

      <button type="submit" className="text-xs font-medium text-brand-600 hover:underline">
        Save
      </button>
    </form>
  );
}

export default async function AiModelsPage() {
  const [providers, models] = await Promise.all([
    db.select().from(aiProviders).orderBy(asc(aiProviders.sort)),
    db.select().from(aiModels).orderBy(asc(aiModels.sort)),
  ]);

  return (
    <div>
      <PageHeader
        title="AI models"
        description="Adding a model here makes it available everywhere immediately — no deploy. Providers with a key configured can also fetch their live model list. See docs/10-ai-model-registry.md and docs/21-image-engines.md."
      />

      <div className="space-y-6">
        {providers.map((provider) => {
          const providerModels = models.filter((m) => m.providerId === provider.id);
          const chatModels = providerModels.filter((m) => m.modality === 'text');
          const imageModels = providerModels.filter((m) => m.modality === 'image');
          const isImageOnly = provider.supports.includes('images') && !provider.supports.includes('stream');

          return (
            <Card key={provider.id}>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{provider.label}</CardTitle>
                  <CardDescription>
                    Env: <code className="font-mono">{provider.apiKeyEnv}</code>
                    {provider.baseUrlEnv ? (
                      <>
                        {' '}
                        / <code className="font-mono">{provider.baseUrlEnv}</code>
                      </>
                    ) : null}
                  </CardDescription>
                </div>

                {!isImageOnly ? (
                  <form action={updateAiProviderAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={provider.id} />
                    <input type="hidden" name="isActive" value={String(provider.isActive)} />
                    <Label htmlFor={`default-${provider.id}`} className="mb-0 whitespace-nowrap text-xs">
                      Default model
                    </Label>
                    <Input
                      id={`default-${provider.id}`}
                      name="defaultModel"
                      defaultValue={provider.defaultModel}
                      className="h-8 w-40 text-xs"
                    />
                    <button type="submit" className="text-xs font-medium text-brand-600 hover:underline">
                      Save
                    </button>
                  </form>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {!isImageOnly ? (
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">Chat models</p>
                    {chatModels.length === 0 ? (
                      <p className="text-sm text-slate-400">No chat models registered for this provider yet.</p>
                    ) : (
                      chatModels.map((model) => <ModelRow key={model.id} model={model} />)
                    )}
                  </div>
                ) : null}

                {provider.supports.includes('images') ? (
                  <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">Image models</p>
                    {imageModels.length === 0 ? (
                      <p className="text-sm text-slate-400">No image models registered for this provider yet — fetch its live catalog below.</p>
                    ) : (
                      imageModels.map((model) => <ModelRow key={model.id} model={model} />)
                    )}
                  </div>
                ) : null}

                <FetchModelsPanel providerId={provider.id} />
              </CardContent>
            </Card>
          );
        })}

        <InlineForm action={createAiModelAction} title="Add a model" submitLabel="Add model">
          <ProviderField providers={providers.map((p) => ({ id: p.id, label: p.label }))} />
          <div>
            <Label htmlFor="modelId">Model id</Label>
            <Input id="modelId" name="modelId" required placeholder="gpt-5.1" />
            <Hint>The exact string the provider's API expects.</Hint>
          </div>
          <div>
            <Label htmlFor="label">Display label</Label>
            <Input id="label" name="label" required placeholder="GPT-5.1" />
          </div>
          <div>
            <Label htmlFor="modality">Modality</Label>
            <Select id="modality" name="modality" defaultValue="text">
              <option value="text">Chat / text</option>
              <option value="image">Image generation</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="tier">Tier</Label>
            <Select id="tier" name="tier" defaultValue="">
              <option value="">No tier (advanced-only)</option>
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="advanced">Advanced</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="creditsPer1k">Credits per 1k tokens</Label>
            <Input id="creditsPer1k" name="creditsPer1k" type="number" min={0} defaultValue={5} required />
          </div>
        </InlineForm>
      </div>
    </div>
  );
}
