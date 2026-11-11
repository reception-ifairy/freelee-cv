/**
 * The vocabulary of a connection check, shared by the server registry
 * (src/lib/connections/registry.ts) and the card that shows it
 * (src/components/admin/connection-card.tsx).
 *
 * Plain module — no `server-only`, no `@/db` — for the same reason as
 * src/lib/settings-schema.ts: a client component needs these types and the
 * state list, and must not pull the database into the browser bundle.
 */

/**
 * The five answers a check can give. Kept identical to `ProviderHealth`
 * (src/lib/ai/health.ts) so an AI provider's result passes straight through,
 * and so "no credit" stays its own state everywhere: a key that is accepted on
 * an account that cannot pay is the case every other signal gets wrong.
 */
export const TEST_STATES = ['ok', 'no-key', 'bad-key', 'no-credit', 'error'] as const;
export type TestState = (typeof TEST_STATES)[number];

export type TestResult = { state: TestState; message: string };

/** What is remembered between visits, under `conn_test:<id>`. Never the key — only what the check said and when. */
export type StoredTest = TestResult & { at: string };

export type FetchItem = { id: string; label: string };
export type FetchResult = { ok: boolean; summary: string; items?: FetchItem[] };

export type ConnectionField = {
  key: string;
  label: string;
  type: 'secret' | 'string';
  hint?: string;
  placeholder?: string;
  /** Checked on save. Only `url` exists so far — the Ollama address. */
  format?: 'url';
};

/** A field as the card receives it: secrets never carry a value, only whether one is saved. */
export type ConnectionFieldView = ConnectionField & { value?: string; saved?: boolean };
