import 'server-only';
import { generateText } from 'ai';
import { getModel, getProviderRegistry, providerIsConfigured, resolveProviderId, resolveProviderKeys, resolveTierModel } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';
import { ADAPTATIONS } from './profile';

/**
 * "Anything else?" (owner decision 2026-11-12): a parent may describe their
 * child's needs in their own words — once. The text is turned into the
 * practical adaptations from the checklist by one call to the fast model, and
 * then dropped: it is never stored, never logged, never shown to a tutor.
 * Only the chosen adaptation ids are kept (in the sealed profile).
 *
 * Needs its own consent box on the form, because the words may describe health.
 */
export async function adaptationsFromNotes(notes: string): Promise<string[]> {
  const text = notes.trim().slice(0, 1200);
  if (!text) return [];
  const registry = await getProviderRegistry();
  const list = ADAPTATIONS.map((a) => `${a.id}: ${a.label}`).join('\n');
  // The default provider first, then OpenAI (what the tutors run on): on 2026-11-12 the default
  // (Gemini) had run out of prepaid credit, and a parent's save must not fail for that.
  const providers = Array.from(new Set([resolveProviderId(await getSettingString('ai_default_provider', 'openai')), resolveProviderId('openai')]));
  let lastError: unknown = null;
  for (const providerId of providers) {
    const keys = await resolveProviderKeys(providerId);
    if (!providerIsConfigured(registry, providerId, keys.apiKey ?? null)) continue;
    const modelId = resolveTierModel(registry, providerId, 'fast') || registry[providerId].defaultModel;
    try {
      const { text: answer } = await generateText({
        model: getModel(registry, providerId, modelId, keys),
        system:
          'A parent describes what helps their child learn. Choose which of these lesson adaptations fit. ' +
          'Answer with the matching ids only, comma-separated, or "none". Never repeat or summarise what the parent wrote.\n\n' + list,
        prompt: text,
        maxOutputTokens: 400,
      });
      const ids = new Set(ADAPTATIONS.map((a) => a.id));
      return Array.from(new Set(answer.split(/[\s,]+/).map((s) => s.trim()).filter((s) => ids.has(s))));
    } catch (error) {
      lastError = error; // never logged with the text — the caller reports a generic failure
    }
  }
  throw lastError ?? new Error('No AI provider is configured.');
}
