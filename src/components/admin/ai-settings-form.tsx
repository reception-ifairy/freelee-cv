'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSettingsAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';
import { CardRadioGroup } from '@/components/ui/card-radio-group';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import type { ProviderRegistry } from '@/lib/ai/registry';

const MODEL_TIERS = [
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'advanced', label: 'Advanced' },
] as const;

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save AI settings'}
    </button>
  );
}

function fieldName(key: string) {
  const field = SETTINGS_SCHEMA.ai.find((item) => item.key === key);
  return `${key}:${field?.type ?? 'string'}`;
}

type Props = { values: Record<string, string | boolean>; providers: ProviderRegistry };

export function AiSettingsForm({ values, providers }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettingsAction, null);

  const openaiTiers = providers.openai.tiers!;
  const currentOpenaiDefault = String(values.openai_default_model ?? '');
  const initialTier = (Object.entries(openaiTiers).find(([, model]) => model === currentOpenaiDefault)?.[0] ??
    'fast') as keyof typeof openaiTiers;
  const [tier, setTier] = useState<keyof typeof openaiTiers>(initialTier);
  const [advancedOpen, setAdvancedOpen] = useState(
    () =>
      Boolean(values.anthropic_api_key) ||
      Boolean(values.anthropic_default_model) ||
      Boolean(values.openrouter_api_key) ||
      Boolean(values.ollama_base_url),
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="__group" value="ai" />
      <FormMessage state={state} />

      <Card className="space-y-5 p-6">
        <div>
          <h3 className="font-semibold">OpenAI — default provider</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every persona runs on OpenAI unless it's individually switched to another provider from its own
            editor's advanced section.
          </p>
        </div>

        <div>
          <Label htmlFor="openai_api_key">OpenAI API key</Label>
          <Input
            id="openai_api_key"
            name={fieldName('openai_api_key')}
            type="password"
            className="font-mono"
            placeholder="•••••••• (leave blank to keep current)"
          />
          <Hint>Blank leaves the existing value untouched.</Hint>
        </div>

        <div>
          <Label>Default model tier</Label>
          <input type="hidden" name={fieldName('openai_default_model')} value={openaiTiers[tier]} />
          <CardRadioGroup
            name="_openai_default_tier"
            value={tier}
            onChange={(id) => setTier(id as keyof typeof openaiTiers)}
            items={MODEL_TIERS.map((item) => ({ id: item.id, label: item.label, meta: openaiTiers[item.id] }))}
          />
          <Hint>Used whenever a persona has no tier or model of its own set.</Hint>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h3 className="font-semibold">Runtime credits</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="guest_free_messages">Free messages before signup</Label>
            <Input
              id="guest_free_messages"
              name={fieldName('guest_free_messages')}
              type="number"
              defaultValue={String(values.guest_free_messages ?? '')}
            />
          </div>
          <div>
            <Label htmlFor="signup_bonus_credits">Signup bonus credits</Label>
            <Input
              id="signup_bonus_credits"
              name={fieldName('signup_bonus_credits')}
              type="number"
              defaultValue={String(values.signup_bonus_credits ?? '')}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="block font-semibold">Advanced providers</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">
              Anthropic, OpenRouter, Ollama — only needed if a persona is deliberately switched off OpenAI.
            </span>
          </span>
          <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
            {advancedOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {advancedOpen ? (
          <div className="mt-5 space-y-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Anthropic</h4>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="anthropic_api_key">API key</Label>
                  <Input
                    id="anthropic_api_key"
                    name={fieldName('anthropic_api_key')}
                    type="password"
                    className="font-mono"
                    placeholder="•••••••• (leave blank to keep current)"
                  />
                </div>
                <div>
                  <Label htmlFor="anthropic_default_model">Default model</Label>
                  <Input
                    id="anthropic_default_model"
                    name={fieldName('anthropic_default_model')}
                    list="anthropic-models"
                    defaultValue={String(values.anthropic_default_model ?? '')}
                    placeholder={providers.anthropic.defaultModel}
                  />
                  <datalist id="anthropic-models">
                    {providers.anthropic.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">OpenRouter</h4>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="openrouter_api_key">API key</Label>
                  <Input
                    id="openrouter_api_key"
                    name={fieldName('openrouter_api_key')}
                    type="password"
                    className="font-mono"
                    placeholder="•••••••• (leave blank to keep current)"
                  />
                </div>
                <div>
                  <Label htmlFor="openrouter_default_model">Default model</Label>
                  <Input
                    id="openrouter_default_model"
                    name={fieldName('openrouter_default_model')}
                    defaultValue={String(values.openrouter_default_model ?? '')}
                    placeholder={providers.openrouter.defaultModel}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Ollama (local)</h4>
              <div>
                <Label htmlFor="ollama_base_url">Base URL</Label>
                <Input
                  id="ollama_base_url"
                  name={fieldName('ollama_base_url')}
                  defaultValue={String(values.ollama_base_url ?? '')}
                  placeholder={providers.ollama.fallbackBaseUrl}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ai_default_provider">Fallback provider (rarely needed)</Label>
              <Input
                id="ai_default_provider"
                name={fieldName('ai_default_provider')}
                defaultValue={String(values.ai_default_provider ?? '')}
                placeholder="openai"
              />
              <Hint>Only matters if a chat somehow has no provider at all — OpenAI is used otherwise.</Hint>
            </div>
          </div>
        ) : null}
      </Card>

      <SaveButton />
    </form>
  );
}
