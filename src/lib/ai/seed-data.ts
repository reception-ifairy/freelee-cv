/**
 * One-time seed data — the exact content of the old static `PROVIDERS` const
 * (src/lib/ai/registry.ts, pre-2026-08-06), converted into DB rows by
 * scripts/seed-ai-models.ts. Not imported by the runtime registry — once
 * seeded and verified, this file only matters for reference/re-seeding a
 * fresh database (e.g. after `db:migrate` on a new environment).
 */
export const PROVIDER_SEED = [
  {
    key: 'openai',
    label: 'OpenAI',
    supports: ['stream', 'vision', 'images'],
    defaultModel: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    fallbackBaseUrl: null,
    sort: 0,
    models: [
      { modelId: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'fast', creditsPer1k: 2 },
      { modelId: 'gpt-4o', label: 'GPT-4o', tier: 'balanced', creditsPer1k: 20 },
      { modelId: 'gpt-4.1', label: 'GPT-4.1', tier: 'advanced', creditsPer1k: 25 },
      // Reasoning model with different latency/temperature semantics —
      // deliberately no tier, reachable only via "advanced" in the persona form.
      { modelId: 'o4-mini', label: 'o4-mini (reasoning)', tier: null, creditsPer1k: 15 },
    ],
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    supports: ['stream', 'vision'],
    defaultModel: 'claude-sonnet-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseUrlEnv: null,
    fallbackBaseUrl: null,
    sort: 1,
    models: [
      { modelId: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'fast', creditsPer1k: 4 },
      { modelId: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', tier: 'balanced', creditsPer1k: 18 },
      { modelId: 'claude-opus-4-1', label: 'Claude Opus 4.1', tier: 'advanced', creditsPer1k: 90 },
    ],
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    supports: ['stream'],
    defaultModel: 'openai/gpt-4o-mini',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    fallbackBaseUrl: 'https://openrouter.ai/api/v1',
    sort: 2,
    models: [],
  },
  {
    key: 'ollama',
    label: 'Ollama (local)',
    supports: ['stream'],
    defaultModel: 'llama3.2',
    apiKeyEnv: 'OLLAMA_API_KEY',
    baseUrlEnv: 'OLLAMA_BASE_URL',
    fallbackBaseUrl: 'http://localhost:11434/v1',
    sort: 3,
    models: [],
  },
] as const;
