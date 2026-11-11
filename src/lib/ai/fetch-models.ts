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

/**
 * 'embedding' is a real outcome: the OpenAI fetcher has classified
 * `text-embedding-*` as embedding since the Knowledgebase (docs/48), but the
 * type still said text-or-image, so the filter below quietly narrowed those
 * rows away from the compiler's view while letting them through at runtime.
 */
export type FetchedModel = { id: string; label: string; modality: 'text' | 'image' | 'embedding' };
export type FetchModelsResult = { models: FetchedModel[] } | { error: string };

async function resolveApiKey(providerKey: string, apiKeyEnv: string): Promise<string | undefined> {
  const fromSettings = await getSettingString(`${providerKey}_api_key`);
  return fromSettings || process.env[apiKeyEnv] || undefined;
}

/**
 * Settings, then the provider's env var, then the row's fallback — the same
 * order `getModel()` uses. Exported so the health check asks the server a chat
 * would actually talk to, rather than a hardcoded one.
 */
export async function resolveBaseUrl(
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

/**
 * OpenAI's `/v1/models` has no capability flag — id prefixes are the only
 * signal, so this is a heuristic, not authoritative.
 *
 * Tighter than it was, because "Fetch models" now adds everything it finds
 * (as preview) instead of waiting for someone to tick boxes: an audio,
 * realtime or speech model filed as `text` would sit in the catalogue looking
 * like a chat model it cannot be.
 */
function classifyOpenAiModel(id: string): FetchedModel['modality'] | null {
  if (/^(gpt-image|dall-e|chatgpt-image)/.test(id)) return 'image';
  // Kept out until the Knowledgebase existed, since nothing could consume one.
  // Now they are the thing that indexes the library (docs/48).
  if (/^text-embedding-/.test(id)) return 'embedding';
  if (/(audio|realtime|transcribe|tts)/.test(id)) return null;
  // `o1`, `o3` exist as bare ids as well as `o3-mini`, so the dash is optional.
  if (/^(gpt-|o\d(-|$)|chatgpt-)/.test(id)) return 'text';
  return null; // whisper/tts/moderation/etc — still not a model this platform runs
}

/**
 * The optional `OpenAI-Organization` / `OpenAI-Project` headers.
 *
 * Omitted entirely when unset rather than sent empty — OpenAI rejects a blank
 * organization header outright, which would turn "not configured" into a hard
 * 401 that reads like a bad key.
 */
export async function openAiScopeHeaders(): Promise<Record<string, string>> {
  const [organization, project] = await Promise.all([
    getSettingString('openai_organization'),
    getSettingString('openai_project'),
  ]);
  return {
    ...(organization ? { 'OpenAI-Organization': organization } : {}),
    ...(project ? { 'OpenAI-Project': project } : {}),
  };
}

async function fetchOpenAiModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  if (!apiKey) return { error: 'No OpenAI API key configured (Settings → AI, or OPENAI_API_KEY).' };

  try {
    const body = (await fetchJson('https://api.openai.com/v1/models', {
      Authorization: `Bearer ${apiKey}`,
      ...(await openAiScopeHeaders()),
    })) as { data?: { id: string }[] };

    const models = (body.data ?? [])
      .map((m) => ({ id: m.id, modality: classifyOpenAiModel(m.id) }))
      .filter((m): m is { id: string; modality: FetchedModel['modality'] } => m.modality !== null)
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

/**
 * Google is the one provider that doesn't authenticate with a header — the
 * key goes in the query string — and its ids come back prefixed
 * (`models/gemini-2.5-flash`), which has to be stripped or every later call
 * fails on a name the API won't recognise.
 *
 * Filtered to models advertising `generateContent`: the raw list also
 * includes embedding, TTS and other non-chat models, and unlike OpenAI the
 * capability is stated explicitly rather than guessed from the id.
 */
async function fetchGoogleModels(provider: AiProviderRow): Promise<FetchModelsResult> {
  const apiKey = await resolveApiKey(provider.key, provider.apiKeyEnv);
  if (!apiKey) return { error: 'No Google API key configured (Settings → AI, or GOOGLE_API_KEY).' };

  try {
    const body = (await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
      {},
    )) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };

    const models = (body.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => {
        const id = m.name.replace(/^models\//, '');
        // Gemini's image models also advertise `generateContent` (that is how
        // src/lib/ai/generate-image.ts calls them), so the id is the only tell.
        const modality: FetchedModel['modality'] = /-image(-|$)/.test(id) ? 'image' : 'text';
        return { id, label: m.displayName ?? id, modality };
      });

    return { models };
  } catch {
    return { error: 'Could not reach Google — check the API key and try again.' };
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
      data?: { id: string; name?: string; architecture?: { output_modalities?: string[] } }[];
    };

    // Only models that answer in text: this platform has no OpenRouter image
    // or audio driver, so anything else would be a catalogue row nothing can run.
    const models = (body.data ?? [])
      .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes('text'))
      .map((m) => ({ id: m.id, label: m.name ?? m.id, modality: 'text' as const }));
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
    case 'google':
      return fetchGoogleModels(provider);
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
