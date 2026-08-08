import 'server-only';
import { getSettingString } from '@/lib/settings';
import type { AiProviderRow } from '@/db/schema';

/**
 * Live "what models does this provider actually have right now" — the point
 * being provider catalogs change often and nobody should be hand-typing
 * model ids into this codebase as they do. Every fetcher here: resolves the
 * key/base URL exactly the way `getModel()` (src/lib/ai/registry.ts) does —
 * settings table first, then the provider's env var — calls the provider's
 * real endpoint with a 5s timeout, and never throws (same fail-open contract
 * as src/lib/knowledge/registry.ts's `search()`).
 */

export type FetchedModel = { id: string; label: string; modality: 'text' | 'image' };
export type FetchModelsResult = { models: FetchedModel[] } | { error: string };

async function resolveApiKey(providerKey: string, apiKeyEnv: string): Promise<string | undefined> {
  const fromSettings = await getSettingString(`${providerKey}_api_key`);
  return fromSettings || process.env[apiKeyEnv] || undefined;
}

async function resolveBaseUrl(
  providerKey: string,
  baseUrlEnv: string | null,
  fallbackBaseUrl: string | null,
): Promise<string | undefined> {
  const fromSettings = await getSettingString(`${providerKey}_base_url`);
  return fromSettings || (baseUrlEnv ? process.env[baseUrlEnv] : undefined) || fallbackBaseUrl || undefined;
}

// 15s, not the 5s used for a live chat-turn's knowledge-source search
// (src/lib/knowledge/registry.ts) — this runs from a deliberate, occasional
// admin click, not a hot request path, and some catalogs (OpenAI's /v1/models
// returns 100+ entries) genuinely take longer than 5s on this box.
async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** OpenAI's `/v1/models` has no capability flag — id prefixes are the only signal, so this is a heuristic, not authoritative. */
function classifyOpenAiModel(id: string): 'text' | 'image' | null {
  if (/^(gpt-image|dall-e)/.test(id)) return 'image';
  if (/^(gpt-|o1-|o3-|o4-|chatgpt-)/.test(id)) return 'text';
  return null; // embeddings/whisper/tts/moderation/etc — not a chat or image model, excluded
}

async function fetchOpenAiModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  if (!apiKey) return { error: 'No OpenAI API key configured (Settings → AI, or OPENAI_API_KEY).' };

  try {
    const body = (await fetchJson('https://api.openai.com/v1/models', {
      Authorization: `Bearer ${apiKey}`,
    })) as { data?: { id: string }[] };

    const models = (body.data ?? [])
      .map((m) => ({ id: m.id, modality: classifyOpenAiModel(m.id) }))
      .filter((m): m is { id: string; modality: 'text' | 'image' } => m.modality !== null)
      .map((m) => ({ id: m.id, label: m.id, modality: m.modality }));

    return { models };
  } catch {
    return { error: 'Could not reach OpenAI — check the API key and try again.' };
  }
}

async function fetchAnthropicModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  if (!apiKey) return { error: 'No Anthropic API key configured (Settings → AI, or ANTHROPIC_API_KEY).' };

  try {
    const body = (await fetchJson('https://api.anthropic.com/v1/models', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    })) as { data?: { id: string; display_name?: string }[] };

    const models = (body.data ?? []).map((m) => ({
      id: m.id,
      label: m.display_name ?? m.id,
      modality: 'text' as const,
    }));

    return { models };
  } catch {
    return { error: 'Could not reach Anthropic — check the API key and try again.' };
  }
}

async function fetchOpenRouterModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  const baseUrl = await resolveBaseUrl(provider.key, provider.baseUrlEnv, provider.fallbackBaseUrl);
  if (!baseUrl) return { error: 'No OpenRouter base URL configured.' };

  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const body = (await fetchJson(`${baseUrl.replace(/\/$/, '')}/models`, headers)) as {
      data?: { id: string; name?: string }[];
    };

    const models = (body.data ?? []).map((m) => ({ id: m.id, label: m.name ?? m.id, modality: 'text' as const }));
    return { models };
  } catch {
    return { error: 'Could not reach OpenRouter — check the base URL and try again.' };
  }
}

async function fetchOllamaModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const baseUrl = await resolveBaseUrl(provider.key, provider.baseUrlEnv, provider.fallbackBaseUrl);
  if (!baseUrl) return { error: 'No Ollama base URL configured.' };

  try {
    const body = (await fetchJson(`${baseUrl.replace(/\/$/, '')}/models`, {})) as { data?: { id: string }[] };
    const models = (body.data ?? []).map((m) => ({ id: m.id, label: m.id, modality: 'text' as const }));
    return { models };
  } catch {
    return { error: 'Could not reach Ollama — is a local server running at the configured base URL?' };
  }
}

/** Stability's real list-engines call — the one provider whose endpoint is literally named this, matching the "engine" terminology used elsewhere in this feature. */
async function fetchStabilityModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  if (!apiKey) return { error: 'No Stability AI API key configured (Settings → AI, or STABILITY_API_KEY).' };

  try {
    const body = (await fetchJson('https://api.stability.ai/v1/engines/list', {
      Authorization: `Bearer ${apiKey}`,
    })) as { id: string; name?: string; type?: string }[];

    const models = (Array.isArray(body) ? body : [])
      .filter((e) => !e.type || e.type === 'PICTURE')
      .map((e) => ({ id: e.id, label: e.name ?? e.id, modality: 'image' as const }));

    return { models };
  } catch {
    return { error: 'Could not reach Stability AI — check the API key and try again.' };
  }
}

export async function fetchProviderModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  switch (provider.key) {
    case 'openai':
      return fetchOpenAiModels(provider);
    case 'anthropic':
      return fetchAnthropicModels(provider);
    case 'openrouter':
      return fetchOpenRouterModels(provider);
    case 'ollama':
      return fetchOllamaModels(provider);
    case 'stability':
      return fetchStabilityModels(provider);
    default:
      return { error: `No live model fetch available for "${provider.key}" yet.` };
  }
}
