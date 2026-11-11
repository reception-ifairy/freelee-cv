'use client';

import { useActionState, useState } from 'react';
import { saveSettingsAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label, Hint, FormMessage } from '@/components/ui/field';
import { CardRadioGroup } from '@/components/ui/card-radio-group';
import { GridSelect } from '@/components/ui/grid-select';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import { CHAT_PROVIDER_IDS, type ModelTier } from '@/lib/ai/provider-ids';
import type { ProviderRegistry } from '@/lib/ai/registry';

const MODEL_TIERS: { id: ModelTier; label: string }[] = [
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'advanced', label: 'Advanced' },
];

const MODERATION_MODES = [
  { id: 'wordlist', label: 'Word list', hint: 'Free and instant. Catches spelling, not meaning.' },
  { id: 'ai', label: 'AI check', hint: 'A small model call per message. Catches meaning; costs a little.' },
  { id: 'off', label: 'Off', hint: 'No filtering, even for bots with the filter ticked.' },
];

function fieldName(key: string) {
  const field = SETTINGS_SCHEMA.ai.find((item) => item.key === key);
  return `${key}:${field?.type ?? 'string'}`;
}

type Props = { values: Record<string, string | boolean>; providers: ProviderRegistry };

/**
 * The AI settings that are not keys.
 *
 * This was "Save AI settings" — keys, models and credits in one form. Keys now
 * live in their own cards above it (each with Save → Test → Fetch), so what is
 * left is defaults: which model a bot falls back to, what visitors get for
 * free, and how input is moderated. Several of these existed in
 * SETTINGS_SCHEMA without ever being rendered — the Google default model, the
 * moderation mode, the blocked-word list — so they could only be changed in
 * the database.
 */
export function AiDefaultsForm({ values, providers }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSettingsAction, null);

  // OpenAI has no tiers when none of its Stable models is assigned one — a
  // fresh install, or after a catalogue clean-up. The old `tiers!` crashed the
  // whole settings page in that state; a plain model box is shown instead.
  const openaiTiers = providers.openai?.tiers ?? {};
  const tierItems = MODEL_TIERS.filter((item) => openaiTiers[item.id]);
  const currentOpenaiDefault = String(values.openai_default_model ?? '');
  const [tier, setTier] = useState<ModelTier | null>(
    () => tierItems.find((item) => openaiTiers[item.id] === currentOpenaiDefault)?.id ?? null,
  );
  const [fallbackProvider, setFallbackProvider] = useState(String(values.ai_default_provider ?? ''));
  const [moderation, setModeration] = useState(String(values.moderation_mode || 'wordlist'));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="__group" value="ai" />
      <FormMessage state={state} />

      <Card className="space-y-5 p-6">
        <div>
          <h4 className="font-semibold">Default models</h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Used whenever a bot has no tier or model of its own. Only Stable models are suggested.
          </p>
        </div>

        <div>
          <Label htmlFor={tierItems.length === 0 ? 'openai_default_model' : undefined}>OpenAI</Label>
          {tierItems.length > 0 ? (
            <>
              {/* Until a tier is picked, the current value is sent back
                  unchanged — a default that matches no tier used to be
                  silently replaced by "fast" on the next save. */}
              <input
                type="hidden"
                name={fieldName('openai_default_model')}
                value={tier ? (openaiTiers[tier] ?? '') : currentOpenaiDefault}
              />
              <CardRadioGroup
                name="_openai_default_tier"
                value={tier ?? ''}
                onChange={(id) => setTier(id as ModelTier)}
                items={tierItems.map((item) => ({ id: item.id, label: item.label, meta: openaiTiers[item.id] }))}
              />
              {tier === null && currentOpenaiDefault ? (
                <Hint>
                  Currently <code className="font-mono">{currentOpenaiDefault}</code>, which is not one of the tiers.
                  Pick a tier to change it.
                </Hint>
              ) : null}
            </>
          ) : (
            <ModelInput providerKey="openai" values={values} providers={providers} />
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {(['anthropic', 'google', 'openrouter'] as const).map((key) => (
            <div key={key} className="min-w-0">
              <Label htmlFor={`${key}_default_model`}>{providers[key]?.label ?? key}</Label>
              <ModelInput providerKey={key} values={values} providers={providers} />
            </div>
          ))}
        </div>
        <Hint>Blank uses the default model picked for that provider under Models.</Hint>
      </Card>

      <Card className="space-y-3 p-6">
        <div>
          <h4 className="font-semibold">Fallback provider</h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Only matters if a chat somehow has no provider at all. Rarely needed.
          </p>
        </div>
        <div className="max-w-sm">
          <GridSelect
            name={fieldName('ai_default_provider')}
            options={[
              { id: '', label: 'OpenAI (default)' },
              ...CHAT_PROVIDER_IDS.filter((id) => id !== 'openai').map((id) => ({ id, label: providers[id]?.label ?? id })),
            ]}
            value={fallbackProvider}
            onChange={setFallbackProvider}
            columns={2}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h4 className="font-semibold">Free use</h4>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="guest_free_messages">Free messages before signup</Label>
            <Input
              id="guest_free_messages"
              name={fieldName('guest_free_messages')}
              type="number"
              min={0}
              defaultValue={String(values.guest_free_messages ?? '')}
            />
          </div>
          <div>
            <Label htmlFor="signup_bonus_credits">Credits given at signup</Label>
            <Input
              id="signup_bonus_credits"
              name={fieldName('signup_bonus_credits')}
              type="number"
              min={0}
              defaultValue={String(values.signup_bonus_credits ?? '')}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-6">
        <div>
          <h4 className="font-semibold">Moderation</h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Only applies to bots with &ldquo;Filter offensive input&rdquo; ticked.
          </p>
        </div>
        <div>
          <input type="hidden" name={fieldName('moderation_mode')} value={moderation} />
          <CardRadioGroup name="_moderation_mode" value={moderation} onChange={setModeration} items={MODERATION_MODES} />
        </div>
        <div>
          <Label htmlFor="badword_list">Blocked words</Label>
          <Textarea
            id="badword_list"
            name={fieldName('badword_list')}
            rows={4}
            defaultValue={String(values.badword_list ?? '')}
            placeholder="Leave blank to use the built-in list"
          />
          <Hint>Comma or newline separated. A list here replaces the built-in one entirely.</Hint>
        </div>
      </Card>

      <Button type="submit" loading={pending}>
        Save defaults
      </Button>
    </form>
  );
}

function ModelInput({
  providerKey,
  values,
  providers,
}: {
  providerKey: 'openai' | 'anthropic' | 'google' | 'openrouter';
  values: Record<string, string | boolean>;
  providers: ProviderRegistry;
}) {
  const key = `${providerKey}_default_model`;
  const listId = `${providerKey}-models`;
  const models = (providers[providerKey]?.models ?? []).filter((model) => model.modality === 'text');

  return (
    <>
      <Input
        id={key}
        name={fieldName(key)}
        list={models.length > 0 ? listId : undefined}
        defaultValue={String(values[key] ?? '')}
        placeholder={providers[providerKey]?.defaultModel}
        spellCheck={false}
        className="font-mono"
      />
      {models.length > 0 ? (
        <datalist id={listId}>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </datalist>
      ) : null}
    </>
  );
}
