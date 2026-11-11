import 'server-only';
import type { AiProviderRow } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { openAiScopeHeaders, resolveBaseUrl } from './fetch-models';

/**
 * "Can this provider actually answer right now?"
 *
 * A key being present is not the same as a key that works, and a key that
 * works is not the same as an account that can pay. This project has now hit
 * all three states: a Gemini key where several *listed* models 404'd for new
 * users, an ElevenLabs key that was simply absent, and an OpenAI key that
 * authenticates and lists 200 models while every completion returns "You have
 * no credits remaining."
 *
 * The admin previously showed "key set" for that last case, which is true and
 * useless. This asks the provider.
 */

export type ProviderHealth =
  | { state: 'no-key'; message: string }
  | { state: 'ok'; message: string }
  | { state: 'no-credit'; message: string }
  | { state: 'bad-key'; message: string }
  | { state: 'error'; message: string };

async function resolveKey(provider: AiProviderRow): Promise<string | null> {
  return (await getSettingString(`${provider.key}_api_key`)) || process.env[provider.apiKeyEnv] || null;
}

/** Classifies a provider error body into something an admin can act on. */
function classify(status: number, body: string): ProviderHealth {
  const text = body.toLowerCase();

  // "credit balance" is Anthropic's wording ("Your credit balance is too low"),
  // sent as a 400 that would otherwise read as a generic error; 402 is what
  // Stability answers with an empty account.
  if (status === 402 || /no credits|insufficient_quota|exceeded your current quota|billing|credit balance|sufficient credits/.test(text)) {
    return {
      state: 'no-credit',
      message: 'No credit left on this account. The key itself is fine — top it up with the provider; nothing here will run until you do.',
    };
  }
  if (status === 401 || status === 403 || /invalid api key|unauthorized|invalid_api_key|api key not valid/.test(text)) {
    return { state: 'bad-key', message: 'Key rejected. Check it was copied in full and has not been revoked.' };
  }
  if (status === 429) {
    return { state: 'error', message: 'Rate limited by the provider. Wait a moment and test again.' };
  }
  return { state: 'error', message: `The provider returned ${status}. ${body.slice(0, 140)}` };
}

/**
 * Makes the smallest real request the provider offers.
 *
 * Deliberately a **completion**, not a model list: listing succeeds on an
 * unfunded account, which is exactly the state this is meant to catch.
 */
export async function checkProviderHealth(provider: AiProviderRow, model: string): Promise<ProviderHealth> {
  const key = await resolveKey(provider);

  // Ollama runs locally and needs no key at all.
  if (!key && provider.key !== 'ollama') {
    return { state: 'no-key', message: `No key yet. Paste one above and press Save, or set ${provider.apiKeyEnv} on the server.` };
  }

  // Image-only: there is no completion to ask for, and generating a picture
  // to prove the key works would cost far more than this check is worth.
  if (provider.key === 'stability') return checkStabilityBalance(provider, key ?? '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const { endpoint, headers, body } = await requestFor(provider, model, key);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.ok) return { state: 'ok', message: `Works — ${model} answered. This provider is ready to use.` };
    return classify(response.status, await response.text().catch(() => ''));
  } catch {
    return { state: 'error', message: 'Could not reach the provider. Check the network or the base URL.' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Each provider's minimal "say ok" request. */
async function requestFor(provider: AiProviderRow, model: string, key: string | null): Promise<{
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}> {
  const prompt = 'Reply with the single word: ok';

  if (provider.key === 'anthropic') {
    return {
      endpoint: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': key ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: { model, max_tokens: 8, messages: [{ role: 'user', content: prompt }] },
    };
  }

  if (provider.key === 'google') {
    return {
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key ?? ''}`,
      headers: { 'content-type': 'application/json' },
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8 } },
    };
  }

  // Resolved exactly as a chat turn resolves it — settings, then env, then the
  // row's fallback. This used to ignore the `ollama_base_url` setting and
  // hardcode OpenRouter's address, so "Test" could pass against a server the
  // chats were not using (or fail against one they were).
  const configured = await resolveBaseUrl(provider.key, provider.baseUrlEnv, provider.fallbackBaseUrl);
  const base =
    configured ??
    (provider.key === 'ollama'
      ? 'http://localhost:11434/v1'
      : provider.key === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1');

  return {
    endpoint: `${base.replace(/\/$/, '')}/chat/completions`,
    headers: {
      authorization: `Bearer ${key ?? 'ollama'}`,
      'content-type': 'application/json',
      // Only for OpenAI proper. An OpenAI-compatible endpoint (OpenRouter,
      // Ollama) has no notion of an OpenAI organisation, and this test must
      // send exactly what a real chat turn sends — otherwise "Test connection"
      // can pass while the thing it is testing fails.
      ...(provider.key === 'openai' ? await openAiScopeHeaders() : {}),
    },
    // `max_completion_tokens` rather than `max_tokens`: the newer OpenAI
    // models reject the old field outright.
    body: { model, messages: [{ role: 'user', content: prompt }], max_completion_tokens: 8 },
  };
}

/**
 * Stability's account balance — free to call, and it answers both questions
 * the completion check answers for chat providers: is the key real, and can
 * the account pay. A key with zero credits is reported as `no-credit`, not
 * `ok`, for the same reason the chat check exists at all.
 */
async function checkStabilityBalance(provider: AiProviderRow, key: string): Promise<ProviderHealth> {
  const base = (provider.fallbackBaseUrl || 'https://api.stability.ai').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${base}/v1/user/balance`, {
      headers: { authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return classify(response.status, await response.text().catch(() => ''));

    const body = (await response.json().catch(() => ({}))) as { credits?: number };
    const credits = typeof body.credits === 'number' ? body.credits : null;
    if (credits !== null && credits <= 0) {
      return { state: 'no-credit', message: 'No credit left on this account. The key itself is fine — buy credits at Stability, then test again.' };
    }
    return {
      state: 'ok',
      message: credits === null ? 'Works — key accepted.' : `Works — key accepted. ${Math.floor(credits).toLocaleString('en-US')} credits left.`,
    };
  } catch {
    return { state: 'error', message: 'Could not reach Stability AI. Check the network and try again.' };
  } finally {
    clearTimeout(timeout);
  }
}
