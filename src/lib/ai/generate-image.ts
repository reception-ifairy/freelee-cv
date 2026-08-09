import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiModels, aiProviders } from '@/db/schema';
import { getSettingString } from '@/lib/settings';

/**
 * Actually generating an image, as opposed to merely cataloguing the models
 * that could (docs/21-image-engines.md stopped at the catalogue).
 *
 * Written with raw `fetch` rather than a provider SDK: the three APIs disagree
 * about almost everything — auth position, request shape, and where the bytes
 * come back — and an abstraction over three incompatible calls would be longer
 * than the three calls.
 */

export type GeneratedImage = { base64: string; mediaType: string };
export type GenerateResult = { image: GeneratedImage } | { error: string };

/** Generation is slow by nature — this is a deliberate action, not a hot path. */
const TIMEOUT_MS = 90_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Gemini returns the image as an `inlineData` part alongside any text parts. */
async function generateGoogle(modelId: string, apiKey: string, prompt: string): Promise<GenerateResult> {
  const body = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {},
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } },
  )) as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };

  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) return { error: 'The model returned no image.' };
  return { image: { base64: part.inlineData.data, mediaType: part.inlineData.mimeType } };
}

async function generateOpenAi(modelId: string, apiKey: string, prompt: string): Promise<GenerateResult> {
  const body = (await postJson(
    'https://api.openai.com/v1/images/generations',
    { Authorization: `Bearer ${apiKey}` },
    { model: modelId, prompt, n: 1, size: '1024x1024' },
  )) as { data?: { b64_json?: string; url?: string }[] };

  const first = body.data?.[0];
  if (!first?.b64_json) return { error: 'The model returned no image data.' };
  return { image: { base64: first.b64_json, mediaType: 'image/png' } };
}

/** Stability wants multipart and answers with base64 in `image`. */
async function generateStability(modelId: string, apiKey: string, prompt: string): Promise<GenerateResult> {
  const endpoint = modelId.includes('ultra')
    ? 'ultra'
    : modelId.includes('sd3')
      ? 'sd3'
      : 'core';

  const form = new FormData();
  form.set('prompt', prompt);
  form.set('output_format', 'png');
  if (endpoint === 'sd3') form.set('model', modelId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return { error: `Stability returned HTTP ${response.status}.` };

    const body = (await response.json()) as { image?: string; finish_reason?: string };
    // A 200 with CONTENT_FILTERED is Stability's output-side moderation — a
    // refusal, not a failure, and it deserves its own message.
    if (body.finish_reason === 'CONTENT_FILTERED') return { error: 'That prompt was blocked by the image filter.' };
    if (!body.image) return { error: 'Stability returned no image.' };
    return { image: { base64: body.image, mediaType: 'image/png' } };
  } catch {
    return { error: 'Could not reach Stability AI.' };
  } finally {
    clearTimeout(timeout);
  }
}

export type ImageModelChoice = {
  providerKey: string;
  modelId: string;
  label: string;
  creditsPerImage: number;
};

/**
 * The image model the site will use: the first `stable`, `image`-modality row
 * whose provider actually has a key, in sort order. Returns null when nothing
 * is configured, so callers can say "no image model set up" instead of
 * failing mysteriously at request time.
 */
export async function resolveImageModel(): Promise<ImageModelChoice | null> {
  const rows = await db
    .select({
      providerKey: aiProviders.key,
      apiKeyEnv: aiProviders.apiKeyEnv,
      modelId: aiModels.modelId,
      label: aiModels.label,
      creditsPerImage: aiModels.creditsPerImage,
    })
    .from(aiModels)
    .innerJoin(aiProviders, eq(aiProviders.id, aiModels.providerId))
    .where(and(eq(aiModels.modality, 'image'), eq(aiModels.status, 'stable'), eq(aiProviders.isActive, true)))
    .orderBy(asc(aiModels.sort));

  for (const row of rows) {
    const key = (await getSettingString(`${row.providerKey}_api_key`)) || process.env[row.apiKeyEnv];
    if (key) {
      return {
        providerKey: row.providerKey,
        modelId: row.modelId,
        label: row.label,
        creditsPerImage: row.creditsPerImage,
      };
    }
  }

  return null;
}

export async function generateImage(choice: ImageModelChoice, prompt: string): Promise<GenerateResult> {
  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.key, choice.providerKey)).limit(1);
  if (!provider) return { error: 'That image provider is no longer configured.' };

  const apiKey = (await getSettingString(`${choice.providerKey}_api_key`)) || process.env[provider.apiKeyEnv];
  if (!apiKey) return { error: `No API key configured for ${provider.label}.` };

  try {
    switch (choice.providerKey) {
      case 'google':
        return await generateGoogle(choice.modelId, apiKey, prompt);
      case 'openai':
        return await generateOpenAi(choice.modelId, apiKey, prompt);
      case 'stability':
        return await generateStability(choice.modelId, apiKey, prompt);
      default:
        return { error: `Image generation isn't implemented for ${provider.label}.` };
    }
  } catch {
    return { error: `Could not reach ${provider.label}. Try again in a moment.` };
  }
}
