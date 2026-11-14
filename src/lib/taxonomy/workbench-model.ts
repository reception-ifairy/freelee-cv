import 'server-only';
import { getProviderRegistry, resolveProviderId } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';

/**
 * The provider and model the category workbench talks to: the platform's
 * default provider and its default model. One place, so the screen can say
 * which model answers (it was hidden until 2026-11-14) and the route uses the
 * same one.
 */
export async function workbenchModel(): Promise<{ providerId: ReturnType<typeof resolveProviderId>; providerLabel: string; modelId: string | null }> {
  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(await getSettingString('ai_default_provider', 'openai'));
  const modelId = (await getSettingString(`${providerId}_default_model`)) || registry[providerId]?.defaultModel || null;
  return { providerId, providerLabel: registry[providerId]?.label ?? providerId, modelId };
}
