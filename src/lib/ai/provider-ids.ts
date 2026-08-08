/**
 * Provider-id constants with no DB/server dependency, split out of
 * registry.ts so client components (persona-form.tsx's provider picker) can
 * import them without pulling registry.ts's `'server-only'`-guarded `@/db`
 * import into the browser bundle. registry.ts re-exports everything here for
 * every existing server-side consumer.
 */
export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'stability';

const PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'stability'];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as string[]).includes(value);
}

/** Providers with a working chat-completion driver in registry.ts's `getModel()` — the set a persona may actually be assigned to. */
export const CHAT_PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'google', 'openrouter', 'ollama'];

export function isChatProvider(id: string): boolean {
  return (CHAT_PROVIDER_IDS as string[]).includes(id);
}

export type ModelTier = 'fast' | 'balanced' | 'advanced';

export function isModelTier(value: string | null | undefined): value is ModelTier {
  return value === 'fast' || value === 'balanced' || value === 'advanced';
}
