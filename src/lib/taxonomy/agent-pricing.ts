/**
 * What the category agent costs, said on screen (owner, 2026-11-16: the agent
 * runs on Anthropic from the owner's own key, so every reply is real money).
 *
 * Plain module, checked by scripts/verify-category-agent.ts. Prices are
 * Anthropic's first-party list prices per million tokens, as of 2026-11; a
 * cache write costs 1.25x input, a cache read is the listed cache price. Only
 * the models the agent may be set to are listed — an unknown model shows no
 * estimate rather than a wrong one.
 */
export const AGENT_DEFAULT_MODEL = 'claude-opus-5-5';

export type AgentPrice = { label: string; input: number; output: number; cacheRead: number };

export const AGENT_MODELS: Record<string, AgentPrice> = {
  'claude-opus-5-5': { label: 'Claude Opus 5.5', input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', input: 2, output: 10, cacheRead: 0.1 },
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export type AgentUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

export const ZERO_USAGE: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/**
 * US dollars for this usage, or null when the model's price is unknown.
 * `inputTokens` here means the uncached input only (billed at the full rate);
 * cache reads and writes are counted apart.
 */
export function estimateUsd(modelId: string, usage: AgentUsage): number | null {
  const price = AGENT_MODELS[modelId];
  if (!price) return null;
  const perToken = (perMillion: number) => perMillion / 1_000_000;
  return (
    usage.inputTokens * perToken(price.input) +
    usage.cacheWriteTokens * perToken(price.input * 1.25) +
    usage.cacheReadTokens * perToken(price.cacheRead) +
    usage.outputTokens * perToken(price.output)
  );
}

export function addUsage(a: AgentUsage, b: AgentUsage): AgentUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export const formatUsd = (usd: number) => (usd < 0.01 ? '< $0.01' : `$${usd.toFixed(2)}`);
