import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { db } from '@/db';
import { aiProviders, aiModels } from '@/db/schema';
import { isChatProvider, isProviderId, isModelTier } from './provider-ids';
import type { ProviderId, ModelTier } from './provider-ids';

/**
 * DB-backed since 2026-08-06 (Phase 3) — was a static `PROVIDERS` const
 * before. See docs/10-ai-model-registry.md for the migration and the
 * deliberate scope line: **models** are fully dynamic DB rows (add one, it
 * shows up everywhere, zero code) but **providers** stay this fixed
 * TypeScript union, because a new provider still needs a driver branch in
 * getModel() below regardless of what's in the database — same distinction
 * the mined concept doc draws between its `LlmDriver` contract (code) and
 * `ai_models` catalog (data).
 *
 * `'stability'` (added 2026-08-08, docs/21-image-engines.md) is image-only —
 * catalog/admin config only this phase, no execution path, so `getModel()`
 * explicitly refuses it rather than silently building a broken chat handle.
 *
 * `ProviderId`/`CHAT_PROVIDER_IDS`/`isChatProvider`/`isProviderId`/`ModelTier`/
 * `isModelTier` live in `./provider-ids.ts` (no `@/db` import) and are
 * re-exported here — client components that only need those constants
 * (e.g. persona-form.tsx's provider picker) import from there directly so
 * this file's `'server-only'`/`@/db` chain never lands in a browser bundle.
 */
export type { ProviderId, ModelTier } from './provider-ids';
export { CHAT_PROVIDER_IDS, isChatProvider, isProviderId, isModelTier } from './provider-ids';

export type ModelInfo = {
  id: string;
  label: string;
  /** Credits charged per 1,000 tokens. */
  creditsPer1k: number;
  modality: 'text' | 'image';
};

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  supports: readonly string[];
  models: readonly ModelInfo[];
  defaultModel: string;
  apiKeyEnv: string;
  baseUrlEnv?: string;
  fallbackBaseUrl?: string;
  /** Curated Fast/Balanced/Advanced mapping. Absent for providers with no fixed model list. */
  tiers?: Partial<Record<ModelTier, string>>;
};

export type ProviderRegistry = Record<ProviderId, ProviderConfig>;

export function resolveProviderId(value: string | null | undefined): ProviderId {
  if (value && isProviderId(value)) return value;
  const fallback = process.env.AI_DEFAULT_PROVIDER;
  return fallback && isProviderId(fallback) ? fallback : 'openai';
}

/**
 * Builds the full provider/model map from the database — same shape the old
 * static `PROVIDERS` const had, so every consumer keeps working unchanged.
 * Cached per request (React's `cache()`), so a single request that touches
 * the registry several times (route.ts resolves a tier, then bills against
 * it, for instance) only queries once. **Not** cached across requests — an
 * admin edit to a model's pricing/status takes effect on the very next
 * request, matching the "resolved live, never a deploy" principle this
 * registry has always been built around.
 */
export const getProviderRegistry = cache(async (): Promise<ProviderRegistry> => {
  const [providerRows, modelRows] = await Promise.all([
    db.select().from(aiProviders).orderBy(asc(aiProviders.sort)),
    db.select().from(aiModels).where(eq(aiModels.status, 'stable')).orderBy(asc(aiModels.sort)),
  ]);

  const registry = {} as ProviderRegistry;

  for (const row of providerRows) {
    if (!isProviderId(row.key)) continue; // defensive — DB row with an unrecognised key can't have a driver

    const models = modelRows.filter((m) => m.providerId === row.id);
    const tiers: Partial<Record<ModelTier, string>> = {};
    for (const model of models) {
      if (isModelTier(model.tier)) tiers[model.tier] = model.modelId;
    }

    registry[row.key] = {
      id: row.key,
      label: row.label,
      supports: row.supports,
      defaultModel: row.defaultModel,
      apiKeyEnv: row.apiKeyEnv,
      baseUrlEnv: row.baseUrlEnv ?? undefined,
      fallbackBaseUrl: row.fallbackBaseUrl ?? undefined,
      tiers: Object.keys(tiers).length > 0 ? tiers : undefined,
      models: models.map((m) => ({ id: m.modelId, label: m.label, creditsPer1k: m.creditsPer1k, modality: m.modality })),
    };
  }

  return registry;
});

/** The single source of truth for what Fast/Balanced/Advanced resolve to. */
export function resolveTierModel(
  registry: ProviderRegistry,
  providerId: ProviderId,
  tier: ModelTier | null | undefined,
): string | null {
  if (!tier) return null;
  return registry[providerId]?.tiers?.[tier] ?? null;
}

export type ResolvedKeys = { apiKey?: string; baseUrl?: string };

/**
 * Builds a language model handle. Keys are passed in rather than read here, so
 * the caller can source them from the settings table (rotatable without a
 * deploy) and fall back to the environment.
 */
export function getModel(
  registry: ProviderRegistry,
  providerId: ProviderId,
  modelId: string,
  keys: ResolvedKeys = {},
): LanguageModel {
  if (!isChatProvider(providerId)) {
    throw new Error(
      `"${providerId}" is an image-generation provider — it has no chat-completion driver (catalog/admin config only this phase, see docs/21-image-engines.md).`,
    );
  }

  const config = registry[providerId];
  const apiKey = keys.apiKey ?? process.env[config.apiKeyEnv];
  const baseURL =
    keys.baseUrl ?? (config.baseUrlEnv ? process.env[config.baseUrlEnv] : undefined) ?? config.fallbackBaseUrl;

  if (providerId === 'anthropic') {
    return createAnthropic({ apiKey })(modelId);
  }

  // OpenAI and every OpenAI-compatible endpoint share one factory.
  return createOpenAI({ apiKey: apiKey ?? 'not-set', baseURL })(modelId);
}

export function creditsPer1k(registry: ProviderRegistry, providerId: ProviderId, modelId: string): number {
  return registry[providerId]?.models.find((m) => m.id === modelId)?.creditsPer1k ?? 5;
}

export function providerIsConfigured(
  registry: ProviderRegistry,
  providerId: ProviderId,
  settingsKey?: string | null,
): boolean {
  if (providerId === 'ollama') return true; // local, no key needed
  return Boolean(settingsKey ?? process.env[registry[providerId]?.apiKeyEnv]);
}
