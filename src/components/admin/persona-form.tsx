'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { savePersonaAction, publishPersonaVersionAction, revertPersonaVersionAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import type { Category, Persona, PersonaVersion } from '@/db/schema';
import { PERSONALITY_TRAITS } from '@/db/schema';
import { Input, Textarea, Select, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardRadioGroup } from '@/components/ui/card-radio-group';
import { CHAT_LAYOUTS, layoutsForSurface } from '@/lib/chat/layouts';
import type { ChatLayoutKey } from '@/lib/chat/layouts';
import { GridSelect } from '@/components/ui/grid-select';
import { CHAT_PROVIDER_IDS } from '@/lib/ai/provider-ids';
import type { ProviderRegistry } from '@/lib/ai/registry';
import { AUDIENCE_TYPES, APPROACH_TO_UNKNOWN, INTERACTION_STYLES, PROMPT_TECHNIQUES } from '@/lib/persona/prompt';
import { GUARDRAILS } from '@/lib/persona/guardrails';
import { segmentsForAudienceType } from '@/lib/persona/audience-segments';
import { cn, initialsOf } from '@/lib/utils';

const TABS = ['basics', 'prompt', 'model', 'personality', 'capabilities', 'publishing'] as const;
type Tab = (typeof TABS)[number];

const MODEL_TIERS = [
  { id: 'fast', label: 'Fast', hint: 'Cheapest and quickest — good for everyday replies.' },
  { id: 'balanced', label: 'Balanced', hint: 'Stronger reasoning at a moderate cost.' },
  { id: 'advanced', label: 'Advanced', hint: 'Most capable — for demanding tasks.' },
] as const;

const CAPABILITIES: { key: string; label: string }[] = [
  { key: 'vision', label: 'Accept image uploads' },
  { key: 'images', label: 'Generate images' },
  { key: 'voiceIn', label: 'Voice input (speech to text)' },
  { key: 'voiceOut', label: 'Voice output (text to speech)' },
  { key: 'share', label: 'Allow sharing conversations' },
  { key: 'copy', label: 'Show copy button' },
  { key: 'embed', label: 'Allow embedding on other sites' },
  { key: 'suggestions', label: 'Show starter suggestions' },
  { key: 'badwordFilter', label: 'Filter offensive input' },
  { key: 'tone', label: 'Offer tone selector' },
  { key: 'writing', label: 'Offer writing-style selector' },
  { key: 'output', label: 'Offer output-format selector' },
];

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save persona'}
    </button>
  );
}

type Props = {
  persona?: Persona;
  /** The version being edited — currentVersion normally, or draftVersion when pinVersioning + a draft exists. */
  version?: PersonaVersion;
  /** Past published versions, newest first — for the revert list. Empty for a new persona. */
  versionHistory?: PersonaVersion[];
  categories: Category[];
  selectedCategoryIds: number[];
  providers: ProviderRegistry;
  /** Active rows from `knowledge_sources` (docs/18-knowledge-sources.md) — admin-managed, no longer a hardcoded list. */
  knowledgeSources: { key: string; label: string }[];
  /** What `suggestLayoutForPersona()` would pick — shown so the auto-default is visible, not hidden magic. */
  suggestedLayout?: ChatLayoutKey;
};

export function PersonaForm({
  persona, version, versionHistory = [], categories, selectedCategoryIds, providers, knowledgeSources, suggestedLayout,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePersonaAction, null);
  const [tab, setTab] = useState<Tab>('basics');
  const [name, setName] = useState(persona?.name ?? '');
  const [accent, setAccent] = useState(persona?.accentColor ?? '#6366f1');
  const [provider, setProvider] = useState(version?.aiProvider ?? 'openai');
  const [modelTier, setModelTier] = useState(version?.modelTier ?? (persona ? '' : 'fast'));
  // Advanced (raw provider + model id) opens automatically for personas that
  // already use a non-OpenAI provider or an explicit model with no tier —
  // otherwise the tier picker is the default, primary path.
  const [showAdvancedModel, setShowAdvancedModel] = useState(
    () => Boolean(persona && ((version?.model && !version?.modelTier) || version?.aiProvider !== 'openai')),
  );
  const [modelId, setModelId] = useState(version?.model ?? '');
  const [chatLayout, setChatLayout] = useState(version?.chatLayout ?? '');
  const [useCustomModel, setUseCustomModel] = useState(() => {
    if (!version?.model) return false;
    const providerModels = providers[version.aiProvider as keyof typeof providers]?.models ?? [];
    return !providerModels.some((m) => m.id === version.model);
  });
  const [temperature, setTemperature] = useState(version?.temperature ?? 0.8);
  const [history, setHistory] = useState(version?.historyMessages ?? 8);
  const [traits, setTraits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const trait of PERSONALITY_TRAITS) initial[trait] = version?.personality[trait] ?? 50;
    return initial;
  });

  const suggestions = [0, 1, 2, 3].map((i) => version?.suggestions[i] ?? '');
  const providerKey = provider in providers ? (provider as keyof typeof providers) : 'openai';

  return (
    <>
    <form action={formAction}>
      {persona ? <input type="hidden" name="id" value={persona.id} /> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          {persona ? `Edit ${persona.name}` : 'New persona'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/personas"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <SaveButton />
        </div>
      </div>

      <FormMessage state={state} />

      <div className="my-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.03]">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              'rounded-lg px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider transition',
              tab === item
                ? 'glow-ring bg-white text-slate-900 shadow-sm dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          {/* Inputs stay mounted across tabs — a hidden panel must still submit. */}
          <div className={cn('space-y-5', tab !== 'basics' && 'hidden')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Numera"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" defaultValue={persona?.slug} placeholder="auto-generated" />
              </div>
            </div>

            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" name="tagline" defaultValue={persona?.tagline ?? ''} />
            </div>

            <div>
              <Label htmlFor="expertise">Expertise</Label>
              <Input id="expertise" name="expertise" defaultValue={persona?.expertise ?? ''} />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={persona?.description ?? ''} />
            </div>

            <div>
              <Label htmlFor="accentColor">Accent colour</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-14 rounded-lg border border-slate-200 dark:border-slate-700"
                  aria-label="Accent colour picker"
                />
                <Input name="accentColor" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </div>
            </div>
          </div>

          <div className={cn('space-y-5', tab !== 'prompt' && 'hidden')}>
            <div>
              <Label htmlFor="systemPrompt">System prompt *</Label>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                rows={14}
                required
                className="font-mono text-xs"
                defaultValue={version?.systemPrompt}
              />
              <Hint>
                Personality, curriculum level and any selected modifiers are appended automatically at runtime.
              </Hint>
            </div>

            <div>
              <Label htmlFor="welcomeMessage">Welcome message</Label>
              <Textarea
                id="welcomeMessage"
                name="welcomeMessage"
                rows={3}
                defaultValue={version?.welcomeMessage ?? ''}
              />
            </div>

            <div>
              <Label>Starter suggestions</Label>
              <div className="space-y-2">
                {suggestions.map((value, index) => (
                  <Input
                    key={index}
                    name="suggestions"
                    defaultValue={value}
                    placeholder={`Suggestion ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="blueprintJson">Cognitive blueprint (advanced, optional JSON)</Label>
              <Textarea
                id="blueprintJson"
                name="blueprintJson"
                rows={8}
                className="font-mono text-xs"
                defaultValue={version?.blueprint ? JSON.stringify(version.blueprint, null, 2) : ''}
                placeholder='{ "identity": { "shortDescription": "..." }, "personalityAndNarrativeProfile": { "personalityTraits": ["..."] } }'
              />
              <Hint>
                Optional deep persona schema (identity, narrative, communication, pedagogy, safety). When set it
                is compiled ahead of the system prompt above. Leave blank to use only the fields on this form.
              </Hint>
            </div>
          </div>

          <div className={cn('space-y-5', tab !== 'model' && 'hidden')}>
            {!showAdvancedModel ? (
              <div>
                <input type="hidden" name="aiProvider" value="openai" />
                <Label>Model tier</Label>
                <CardRadioGroup name="modelTier" items={MODEL_TIERS} value={modelTier} onChange={setModelTier} />
                <Hint>
                  Runs on OpenAI. The exact model behind each tier is resolved live, so it keeps working even if
                  OpenAI renames or retires a model — nothing to update per persona.{' '}
                  <button
                    type="button"
                    className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                    onClick={() => setShowAdvancedModel(true)}
                  >
                    Choose a specific model instead
                  </button>
                </Hint>
              </div>
            ) : (
              <div className="space-y-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                {/* No modelTier field is submitted here — its absence is what
                    tells the server this persona uses an explicit model id. */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="aiProvider">Provider</Label>
                    <GridSelect
                      id="aiProvider"
                      name="aiProvider"
                      value={provider}
                      onChange={(id) => {
                        setProvider(id);
                        setModelId('');
                      }}
                      columns={4}
                      options={Object.values(providers)
                        .filter((item) => CHAT_PROVIDER_IDS.includes(item.id))
                        .map((item) => ({ id: item.id, label: item.label }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model</Label>
                    {!useCustomModel ? (
                      <>
                        <GridSelect
                          id="model"
                          value={modelId}
                          onChange={setModelId}
                          columns={2}
                          placeholder={`Provider default (${providers[providerKey].defaultModel})`}
                          options={providers[providerKey].models
                            .filter((model) => model.modality === 'text')
                            .map((model) => ({
                              id: model.id,
                              label: model.label,
                              meta: `${model.id} · ${model.creditsPer1k} cr/1k`,
                            }))}
                        />
                        <Hint>
                          Leave unset to use the provider default.{' '}
                          <button
                            type="button"
                            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                            onClick={() => setUseCustomModel(true)}
                          >
                            Type a model id instead
                          </button>
                        </Hint>
                      </>
                    ) : (
                      <>
                        <Input
                          id="model"
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          placeholder={providers[providerKey].defaultModel}
                        />
                        <Hint>
                          A model id not yet in the catalog — see{' '}
                          <Link href="/admin/ai-models" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                            AI models
                          </Link>{' '}
                          to fetch and add it properly.{' '}
                          {providers[providerKey].models.length > 0 ? (
                            <button
                              type="button"
                              className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                              onClick={() => setUseCustomModel(false)}
                            >
                              Pick from the catalog instead
                            </button>
                          ) : null}
                        </Hint>
                      </>
                    )}
                    <input type="hidden" name="model" value={modelId} />
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                  onClick={() => {
                    setShowAdvancedModel(false);
                    setProvider('openai');
                    setModelTier((current) => current || 'fast');
                  }}
                >
                  Use a model tier instead
                </button>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Temperature — {temperature.toFixed(2)}</Label>
                <input
                  type="range"
                  name="temperature"
                  min={0}
                  max={2}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <Hint>Low = focused and repeatable. High = creative and varied.</Hint>
              </div>

              <div>
                <Label>History messages — {history}</Label>
                <input
                  type="range"
                  name="historyMessages"
                  min={1}
                  max={30}
                  value={history}
                  onChange={(e) => setHistory(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <Hint>How much conversation is resent each turn. More context costs more credits.</Hint>
              </div>

              <div>
                <Label htmlFor="frequencyPenalty">Frequency penalty</Label>
                <Input
                  id="frequencyPenalty"
                  name="frequencyPenalty"
                  type="number"
                  step={0.1}
                  min={-2}
                  max={2}
                  defaultValue={version?.frequencyPenalty ?? 0}
                />
              </div>

              <div>
                <Label htmlFor="presencePenalty">Presence penalty</Label>
                <Input
                  id="presencePenalty"
                  name="presencePenalty"
                  type="number"
                  step={0.1}
                  min={-2}
                  max={2}
                  defaultValue={version?.presencePenalty ?? 0}
                />
              </div>

              <div>
                <Label htmlFor="maxTokens">Max tokens</Label>
                <Input
                  id="maxTokens"
                  name="maxTokens"
                  type="number"
                  defaultValue={version?.maxTokens ?? ''}
                  placeholder="provider default"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="interactionStyle">Interaction style</Label>
                <Select id="interactionStyle" name="interactionStyle" defaultValue={version?.interactionStyle ?? ''}>
                  <option value="">Not set</option>
                  {Object.entries(INTERACTION_STYLES).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
                <Hint>Steers phrasing and tone, independent of temperature.</Hint>
              </div>

              <div>
                <Label htmlFor="approachToUnknown">Approach to the unknown</Label>
                <Select id="approachToUnknown" name="approachToUnknown" defaultValue={version?.approachToUnknown ?? ''}>
                  <option value="">Not set</option>
                  {Object.entries(APPROACH_TO_UNKNOWN).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
                <Hint>What the persona does when it lacks a confident answer.</Hint>
              </div>

              <div>
                <Label htmlFor="promptTechnique">Prompt technique</Label>
                <Select id="promptTechnique" name="promptTechnique" defaultValue={version?.promptTechnique ?? 'direct'}>
                  {Object.entries(PROMPT_TECHNIQUES).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <Checkbox name="thinkingMode" defaultChecked={version?.thinkingMode ?? false} />
                <span>Extended thinking mode (slower, more thorough)</span>
              </label>
            </div>
          </div>

          <div className={cn('space-y-5', tab !== 'personality' && 'hidden')}>
            <div>
              <Label htmlFor="audienceType">Audience type</Label>
              <Select
                id="audienceType"
                name="audienceType"
                defaultValue={version?.audienceType ?? ''}
              >
                <option value="">Not audience-specific</option>
                {Object.entries(AUDIENCE_TYPES).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {id} — {meta.label}
                  </option>
                ))}
              </Select>
              <Hint>Tunes the tone and examples to the target audience.</Hint>
            </div>

            <div>
              <Label>Audience segments</Label>
              <div className="space-y-2">
                {(['B2C', 'B2B', 'B2G'] as const).map((type) => (
                  <details
                    key={type}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    open={type === version?.audienceType}
                  >
                    <summary className="cursor-pointer text-sm font-semibold">{type}</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {segmentsForAudienceType(type).map((segment) => (
                        <label
                          key={segment.code}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-xs transition hover:border-brand-300 dark:border-slate-700"
                        >
                          <Checkbox
                            name="audienceSegments"
                            value={segment.code}
                            defaultChecked={version?.audienceSegments.includes(segment.code) ?? false}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="block font-medium">{segment.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{segment.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <Hint>Admin/data only — not compiled into the system prompt yet.</Hint>
            </div>

            <div>
              <Label htmlFor="knowledgeDomains">Knowledge domains</Label>
              <Input
                id="knowledgeDomains"
                name="knowledgeDomains"
                defaultValue={version?.knowledgeDomains.join(', ') ?? ''}
                placeholder="arithmetic, geometry, patterns"
              />
              <Hint>Comma separated.</Hint>
            </div>

            <div>
              <Label>Grounding sources</Label>
              {knowledgeSources.length === 0 ? (
                <Hint>
                  None configured yet — add one under Admin → Knowledge sources.
                </Hint>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {knowledgeSources.map((source) => (
                    <label
                      key={source.key}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700"
                    >
                      <Checkbox
                        name="groundingSources"
                        value={source.key}
                        defaultChecked={version?.groundingSources.includes(source.key) ?? false}
                      />
                      <span className="text-sm">{source.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <Hint>
                Fetched before every reply and cited in the system prompt. A source outage never blocks the
                turn.
              </Hint>
            </div>

            <div>
              <Label>Personality traits</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                {PERSONALITY_TRAITS.map((trait) => (
                  <div key={trait}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium capitalize">{trait}</span>
                      <span className="text-slate-400">{traits[trait]}</span>
                    </div>
                    <input
                      type="range"
                      name={`personality.${trait}`}
                      min={0}
                      max={100}
                      value={traits[trait]}
                      onChange={(e) => setTraits({ ...traits, [trait]: Number(e.target.value) })}
                      className="mt-1 w-full accent-brand-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cn('space-y-6', tab !== 'capabilities' && 'hidden')}>
            <div>
              <Label>Chat layout</Label>
              <Hint>
                How this persona&apos;s chat window looks and behaves. Leave on{' '}
                <strong>Suggested</strong> to follow the persona&apos;s category and audience — the
                narrative layouts also change the reply format itself. See docs/23-chat-layouts.md.
              </Hint>
              <div className="mt-3">
                <CardRadioGroup
                  name="chatLayout"
                  columns={3}
                  value={chatLayout}
                  onChange={setChatLayout}
                  items={[
                    {
                      id: '',
                      label: 'Suggested',
                      hint: suggestedLayout
                        ? `Currently: ${CHAT_LAYOUTS[suggestedLayout].label}`
                        : 'Picked from category and audience',
                    },
                    ...layoutsForSurface('solo').map((l) => ({
                      id: l.key,
                      label: l.label,
                      hint: l.description,
                    })),
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAPABILITIES.map((capability) => (
                <label
                  key={capability.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700"
                >
                  <Checkbox
                    name={`capabilities.${capability.key}`}
                    defaultChecked={Boolean(
                      version?.capabilities[capability.key as keyof typeof version.capabilities],
                    )}
                  />
                  <span className="text-sm">{capability.label}</span>
                </label>
              ))}
            </div>

            <div>
              <Label>Guardrails</Label>
              <Hint>Compiled into the system prompt (prompt-only — no content is scanned in code).</Hint>
              <div className="mt-3 space-y-4">
                {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                  const items = Object.values(GUARDRAILS).filter((g) => g.severity === severity);
                  if (items.length === 0) return null;
                  return (
                    <div key={severity}>
                      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {severity}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {items.map((guardrail) => (
                          <label
                            key={guardrail.code}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700"
                          >
                            <Checkbox
                              name="guardrails"
                              value={guardrail.code}
                              defaultChecked={version?.guardrails.includes(guardrail.code) ?? false}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="block text-sm font-medium">{guardrail.name}</span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">{guardrail.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={cn('space-y-5', tab !== 'publishing' && 'hidden')}>
            <div>
              <Label>Categories</Label>
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="categoryIds"
                      value={category.id}
                      defaultChecked={selectedCategoryIds.includes(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="creditsPerMessage">Credits per message</Label>
                <Input
                  id="creditsPerMessage"
                  name="creditsPerMessage"
                  type="number"
                  min={0}
                  defaultValue={persona?.creditsPerMessage ?? 0}
                />
                <Hint>0 = charge by actual token usage.</Hint>
              </div>
              <div>
                <Label htmlFor="position">Sort position</Label>
                <Input id="position" name="position" type="number" defaultValue={persona?.position ?? 0} />
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <Checkbox name="pinVersioning" defaultChecked={persona?.pinVersioning ?? false} className="mt-0.5" />
              <span>
                <span className="block font-medium">Version pinning</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Off (default): saving here updates the live persona immediately, same as always. On: saving
                  creates a draft — nothing changes for existing conversations until you publish it below.
                </span>
              </span>
            </label>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">Status</h3>
            <label className="flex items-center justify-between text-sm">
              <span>Published</span>
              <Checkbox name="isActive" defaultChecked={persona?.isActive ?? true} />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Featured on home</span>
              <Checkbox name="isFeatured" defaultChecked={persona?.isFeatured ?? false} />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Premium</span>
              <Checkbox name="isPremium" defaultChecked={persona?.isPremium ?? false} />
            </label>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Preview</h3>
            <div className="mt-4 flex items-center gap-3">
              <div
                className="grid size-12 place-items-center rounded-xl font-bold text-white"
                style={{ background: accent }}
              >
                {initialsOf(name || 'A')}
              </div>
              <p className="truncate font-semibold">{name || 'Untitled persona'}</p>
            </div>
          </Card>
        </aside>
      </div>
    </form>

    {/* Outside the main form — these are separate server actions
        (publishPersonaVersionAction/revertPersonaVersionAction), not part of
        savePersonaAction, and HTML forms can't nest. Only shown once a
        persona exists and has opted into version pinning. */}
    {persona?.pinVersioning ? (
      <Card className="mt-6 space-y-4 p-6">
        <h3 className="text-sm font-semibold">Versions</h3>

        {persona.draftVersionId ? (
          <form
            action={publishPersonaVersionAction}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-900 dark:bg-brand-500/10"
          >
            <input type="hidden" name="personaId" value={persona.id} />
            <div className="min-w-48 flex-1">
              <Label htmlFor="changelog">Publish draft — changelog (optional)</Label>
              <Input id="changelog" name="changelog" placeholder="What changed in this version?" />
            </div>
            <button
              type="submit"
              className="h-10 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Publish new version
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">
            No draft in progress — saving the form above will start one.
          </p>
        )}

        {versionHistory.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {versionHistory.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono">{v.version}</span>
                <Badge tone={v.status === 'published' ? 'green' : 'slate'}>{v.status}</Badge>
                <span className="flex-1 truncate text-xs text-slate-400">{v.changelog}</span>
                <span className="text-xs text-slate-400">
                  {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ''}
                </span>
                {v.id !== persona.currentVersionId ? (
                  <form action={revertPersonaVersionAction}>
                    <input type="hidden" name="personaId" value={persona.id} />
                    <input type="hidden" name="versionId" value={v.id} />
                    <button type="submit" className="text-xs font-medium text-brand-600 hover:underline">
                      Revert to this
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    ) : null}
    </>
  );
}
