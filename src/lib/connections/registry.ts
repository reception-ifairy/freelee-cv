import 'server-only';
import Stripe from 'stripe';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiProviders } from '@/db/schema';
import { deleteSetting, getSettingString, upsertSetting, type SettingValue } from '@/lib/settings';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import { checkProviderHealth } from '@/lib/ai/health';
import { describeSync, syncProviderModels } from '@/lib/ai/sync-models';
import type { ProviderId } from '@/lib/ai/provider-ids';
import { DEFAULT_VOICE_ID, fetchVoices } from '@/lib/voice/elevenlabs';
import { paypalApiBase } from '@/lib/billing/gateways';
import { S3Store, s3ConfigFromEnv } from '@/lib/media/s3-store';
import {
  TEST_STATES,
  type ConnectionField,
  type ConnectionFieldView,
  type FetchResult,
  type StoredTest,
  type TestResult,
} from './types';

/**
 * Every outside service the platform depends on, described once: what it is
 * for in plain words, where its key lives, how to prove it works (Test), and
 * what can be pulled from it once it does (Fetch).
 *
 * The admin used to answer these questions in four different places with four
 * different vocabularies — keys on one screen, "Test connection" and the
 * model import on another, Stripe and S3 nowhere at all. The settings screens
 * now render one card per entry here, and every card behaves the same way:
 * save → Test → Fetch.
 *
 * Results are remembered under `conn_test:<id>` in `settings` (so a page load
 * shows the last answer without spending anything), and only ever the
 * verdict — never the key, never the request.
 */

export const CONNECTION_IDS = [
  'openai', 'anthropic', 'google', 'openrouter', 'ollama', 'stability',
  'tavily', 'elevenlabs', 'resend',
  'stripe', 'paypal', 's3',
] as const;

export type ConnectionId = (typeof CONNECTION_IDS)[number];

export const connectionIdSchema = z.enum(CONNECTION_IDS);

type EnvVar = { name: string; required?: boolean };

type Connection = {
  id: ConnectionId;
  title: string;
  description: string;
  fields: ConnectionField[];
  /**
   * The server env vars this connection reads — as the fallback when a key is
   * not saved here, or as the only source for the env-only ones. Only their
   * *names* and whether they are set ever reach the page.
   */
  env: EnvVar[];
  /** Stripe, PayPal, S3: kept in the server's env file on purpose, never editable from a browser. */
  envOnly?: boolean;
  /** The setting / env var whose presence means there is something to test. Absent: always testable (Ollama has a default address). */
  primary?: { setting?: string; env?: string };
  fetchLabel?: string;
  /** Set when a fetched item can be picked — ElevenLabs' default voice. */
  chooseLabel?: string;
  chosenSetting?: string;
  chosenDefault?: string;
  note?: () => string | undefined;
  test: () => Promise<TestResult>;
  fetch?: () => Promise<FetchResult>;
  choose?: (itemId: string) => Promise<{ error?: string; success?: string }>;
};

/* -------------------------------- helpers -------------------------------- */

const ok = (message: string): TestResult => ({ state: 'ok', message });

const NO_KEY: TestResult = { state: 'no-key', message: 'No key yet. Paste one above and press Save.' };

/**
 * Turns a refused HTTP call into an answer someone can act on. Mirrors
 * `classify()` in src/lib/ai/health.ts for the services that are not AI
 * providers — same states, same words.
 */
function classifyHttp(service: string, status: number, body = ''): TestResult {
  const text = body.toLowerCase();
  // "insufficient" only next to money words — "insufficient permissions" is a
  // key problem, not a billing one.
  if (status === 402 || /insufficient.{0,12}(credit|fund|balance|quota)|no credits|quota|out of credit/.test(text)) {
    return { state: 'no-credit', message: `No credit left on this ${service} account. The key itself is fine — top it up, then test again.` };
  }
  if (status === 401 || status === 403 || /api key is invalid|invalid.{0,12}key|unauthori[sz]ed|invalid_api_key/.test(text)) {
    return { state: 'bad-key', message: 'Key rejected. Check it was copied in full and has not been revoked.' };
  }
  if (status === 429) return { state: 'error', message: `${service} says too many requests just now. Wait a moment and test again.` };
  return { state: 'error', message: `${service} answered with an error (HTTP ${status}). ${body.slice(0, 140)}`.trim() };
}

const unreachable = (service: string): TestResult => ({
  state: 'error',
  message: `Could not reach ${service}. Check the server's network and try again.`,
});

async function settingOrEnv(setting: string, env: string): Promise<string | undefined> {
  return (await getSettingString(setting)) || process.env[env] || undefined;
}

function schemaHelp(key: string): string | undefined {
  for (const fields of Object.values(SETTINGS_SCHEMA)) {
    const field = (fields as readonly { key: string; help?: string }[]).find((item) => item.key === key);
    if (field) return field.help;
  }
  return undefined;
}

/** The settings group a key is filed under, so a key saved from a card lands where the schema expects it. */
function groupFor(key: string): string {
  for (const [group, fields] of Object.entries(SETTINGS_SCHEMA)) {
    if ((fields as readonly { key: string }[]).some((field) => field.key === key)) return group;
  }
  return 'ai';
}

/* ------------------------------ AI providers ----------------------------- */

async function providerRow(id: ProviderId) {
  const [row] = await db.select().from(aiProviders).where(eq(aiProviders.key, id)).limit(1);
  return row ?? null;
}

async function testAiProvider(id: ProviderId): Promise<TestResult> {
  const provider = await providerRow(id);
  if (!provider) return { state: 'error', message: 'This provider is missing from the catalogue. Run the AI model seed first.' };

  // The model a chat falls back to when a bot names none — the setting first,
  // then the provider row, the same order src/app/api/chat/route.ts uses. A
  // test of any other model could pass while real chats fail.
  const model = (await getSettingString(`${id}_default_model`)) || provider.defaultModel;
  const health = await checkProviderHealth(provider, model);
  return { state: health.state, message: health.message };
}

async function fetchAiModels(id: ProviderId): Promise<FetchResult> {
  const provider = await providerRow(id);
  if (!provider) return { ok: false, summary: 'This provider is missing from the catalogue. Run the AI model seed first.' };

  const result = await syncProviderModels(provider);
  if (!result.ok) return { ok: false, summary: result.error };

  return {
    ok: true,
    summary: describeSync(result),
    items: result.added.map((model) => ({
      id: model.id,
      label: model.modality === 'text' ? model.id : `${model.id} (${model.modality})`,
    })),
  };
}

function aiProvider(
  id: ProviderId,
  title: string,
  description: string,
  env: string,
  extraFields: ConnectionField[] = [],
): Connection {
  return {
    id,
    title,
    description,
    fields: [{ key: `${id}_api_key`, label: 'API key', type: 'secret' }, ...extraFields],
    env: [{ name: env }],
    primary: { setting: `${id}_api_key`, env },
    fetchLabel: 'Fetch models',
    test: () => testAiProvider(id),
    fetch: () => fetchAiModels(id),
  };
}

/* --------------------------------- tools --------------------------------- */

async function testTavily(): Promise<TestResult> {
  const key = await settingOrEnv('tavily_api_key', 'TAVILY_API_KEY');
  if (!key) return NO_KEY;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: 'weather today', max_results: 1, search_depth: 'basic' }),
      signal: AbortSignal.timeout(15_000),
    });
    // Tavily's own codes for "your plan is used up" — not in the HTTP spec,
    // and without this they would read as an unexplained error.
    if (response.status === 432 || response.status === 433) {
      return { state: 'no-credit', message: 'No search credit left on this Tavily plan. The key itself is fine — upgrade or wait for the monthly reset.' };
    }
    if (!response.ok) return classifyHttp('Tavily', response.status, await response.text().catch(() => ''));

    const body = (await response.json().catch(() => ({}))) as { results?: unknown[] };
    const count = body.results?.length ?? 0;
    return ok(`Works — key accepted. A test search returned ${count} ${count === 1 ? 'result' : 'results'}.`);
  } catch {
    return unreachable('Tavily');
  }
}

async function currentVoiceId(): Promise<string> {
  return (await getSettingString('elevenlabs_voice_id')) || DEFAULT_VOICE_ID;
}

async function testElevenLabs(): Promise<TestResult> {
  const result = await fetchVoices();
  if (result.ok) {
    return ok(`Works — key accepted. ${result.voices.length} voices available.`);
  }
  if (result.reason !== 'refused') return result.reason === 'no-key' ? NO_KEY : unreachable('ElevenLabs');

  // ElevenLabs keys can be limited to some features. A key made for speech
  // only is real and works for read-aloud, so "Key rejected" would send the
  // owner off to replace a key that is fine.
  if (/missing_permissions/.test(result.detail)) {
    return {
      state: 'bad-key',
      message: 'The key is real but may not read voices. In ElevenLabs, edit the key and allow Voices (read) — or use a key without restrictions.',
    };
  }
  return classifyHttp('ElevenLabs', result.status, result.detail);
}

async function fetchElevenLabsVoices(): Promise<FetchResult> {
  const result = await fetchVoices();
  if (!result.ok) return { ok: false, summary: 'Could not read the voice list. Test again to see why.' };

  const chosen = await currentVoiceId();
  const inUse = result.voices.find((voice) => voice.id === chosen)?.name ?? 'the default voice';
  return {
    ok: true,
    summary: `${result.voices.length} voices · in use: ${inUse}`,
    items: result.voices.map((voice) => ({ id: voice.id, label: voice.name })),
  };
}

/**
 * Saves the picked voice — after checking it against the live list, the same
 * re-resolve-don't-trust-the-browser rule the model import used. Listing is
 * free, and a voice id that is not on the account would fail every read-aloud.
 */
async function chooseElevenLabsVoice(voiceId: string): Promise<{ error?: string; success?: string }> {
  const result = await fetchVoices();
  if (!result.ok) return { error: 'Could not read the voice list just now. Try again.' };

  const voice = result.voices.find((item) => item.id === voiceId);
  if (!voice) return { error: 'That voice is not on this ElevenLabs account any more. Fetch voices again.' };

  await upsertSetting('elevenlabs_voice_id', voice.id, 'string', groupFor('elevenlabs_voice_id'));
  return { success: `${voice.name} now reads replies aloud. Bots with a voice of their own keep it.` };
}

/* --------------------------------- email --------------------------------- */

type ResendDomain = { name: string; status: string };

async function resendDomains(): Promise<
  { ok: true; domains: ResendDomain[] } | { ok: false; result: TestResult; restricted?: boolean }
> {
  const key = await settingOrEnv('resend_api_key', 'RESEND_API_KEY');
  if (!key) return { ok: false, result: NO_KEY };

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text().catch(() => '');

    if (!response.ok) {
      // A "sending access" key is the safer kind to give a server, and it is
      // refused here by design. It is not a broken key.
      if (/restricted_api_key/.test(body)) {
        return {
          ok: false,
          restricted: true,
          result: ok('Works — this key may send email but is not allowed to list domains, so Fetch will have nothing to show.'),
        };
      }
      return { ok: false, result: classifyHttp('Resend', response.status, body) };
    }

    const parsed = JSON.parse(body) as { data?: ResendDomain[] };
    return { ok: true, domains: parsed.data ?? [] };
  } catch {
    return { ok: false, result: unreachable('Resend') };
  }
}

/** Whether the From address can actually send — the most common reason Resend mail never arrives. */
async function fromAddressNote(domains: ResendDomain[]): Promise<string> {
  const from = (await getSettingString('email_from')) || process.env.EMAIL_FROM || '';
  if (!from) return 'No From address is set below yet, so mail is still only written to the server log.';

  const domain = /@([^>\s]+)/.exec(from)?.[1]?.toLowerCase();
  if (!domain) return 'The From address below does not look like an email address.';

  const match = domains.find((item) => item.name.toLowerCase() === domain);
  if (match?.status === 'verified') return `Your From address uses ${domain}, which is verified.`;
  return `Your From address uses ${domain}, which is not verified on Resend — mail from it will be refused.`;
}

async function testResend(): Promise<TestResult> {
  const result = await resendDomains();
  if (!result.ok) return result.result;

  const verified = result.domains.filter((domain) => domain.status === 'verified').length;
  return ok(
    `Works — key accepted. ${result.domains.length} ${result.domains.length === 1 ? 'domain' : 'domains'} on the account, ${verified} verified. ${await fromAddressNote(result.domains)}`,
  );
}

async function fetchResendDomains(): Promise<FetchResult> {
  const result = await resendDomains();
  if (!result.ok) {
    return {
      ok: false,
      summary: result.restricted
        ? 'This is a sending-only key, so Resend will not list domains. Sending still works.'
        : result.result.message,
    };
  }

  const verified = result.domains.filter((domain) => domain.status === 'verified');
  return {
    ok: true,
    summary: `${verified.length} verified sender ${verified.length === 1 ? 'domain' : 'domains'} · ${await fromAddressNote(result.domains)}`,
    items: result.domains.map((domain) => ({
      id: domain.name,
      label: domain.status === 'verified' ? domain.name : `${domain.name} (${domain.status.replace(/_/g, ' ')})`,
    })),
  };
}

/* ------------------------- money and media (env) ------------------------- */

async function testStripe(): Promise<TestResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { state: 'no-key', message: "Not set. Add STRIPE_SECRET_KEY to the server's env file and restart the app." };

  // No retries: a check that quietly tries three times is a check that takes
  // a minute to say "unreachable".
  const stripe = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 0 });
  const mode = /^(sk|rk)_live_/.test(key) ? 'live' : 'test';

  try {
    const [products, prices] = await Promise.all([
      stripe.products.list({ limit: 100 }),
      stripe.prices.list({ limit: 100 }),
    ]);
    const count = (list: { data: unknown[]; has_more: boolean }) => `${list.data.length}${list.has_more ? '+' : ''}`;

    const webhook = process.env.STRIPE_WEBHOOK_SECRET
      ? ''
      : ' STRIPE_WEBHOOK_SECRET is not set, so paid orders will not be confirmed automatically.';
    return ok(
      `Works — key accepted (${mode} mode). ${count(products)} products and ${count(prices)} prices on the account; checkout does not need any, it sets the price itself.${webhook}`,
    );
  } catch (error) {
    const type = (error as { type?: string }).type;
    if (type === 'StripeAuthenticationError') {
      return { state: 'bad-key', message: 'Key rejected. Check STRIPE_SECRET_KEY was copied in full and has not been rolled.' };
    }
    if (type === 'StripePermissionError') {
      return {
        state: 'bad-key',
        message: 'This restricted key may not read products and prices. Allow both (read) in Stripe, or use the full secret key.',
      };
    }
    if (type === 'StripeConnectionError') return unreachable('Stripe');
    if (type === 'StripeRateLimitError') return { state: 'error', message: 'Stripe says too many requests just now. Wait a moment and test again.' };
    return { state: 'error', message: `Stripe answered with an error. ${String((error as Error).message ?? '').slice(0, 140)}` };
  }
}

async function testPayPal(): Promise<TestResult> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    return { state: 'no-key', message: "Not set. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the server's env file and restart the app." };
  }

  const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';

  try {
    // The exact token request checkout makes before every order — free, and
    // it fails the same way checkout would.
    const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 401) {
      return {
        state: 'bad-key',
        message: `PayPal refused the client ID or secret. Check both — and that they were made for ${mode} mode, which is what PAYPAL_MODE says.`,
      };
    }
    if (!response.ok) return classifyHttp('PayPal', response.status, await response.text().catch(() => ''));

    const webhook = process.env.PAYPAL_WEBHOOK_ID
      ? ''
      : ' PAYPAL_WEBHOOK_ID is not set, so paid orders will not be confirmed automatically.';
    return ok(`Works — PayPal accepted the app credentials (${mode} mode).${webhook}`);
  } catch {
    return unreachable('PayPal');
  }
}

async function testS3(): Promise<TestResult> {
  const config = s3ConfigFromEnv();
  if (!config) {
    return {
      state: 'no-key',
      message: "Not set. Add S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_ENDPOINT to the server's env file and restart the app.",
    };
  }

  try {
    const { status } = await new S3Store(config).headBucket();
    if (status >= 200 && status < 300) {
      return ok(
        process.env.MEDIA_STORE === 's3'
          ? 'Works — the bucket answered. New uploads go to it.'
          : "Works — the bucket answered. Uploads still go to this server's disk until MEDIA_STORE=s3 is set.",
      );
    }
    if (status === 401 || status === 403) {
      return { state: 'bad-key', message: 'The bucket refused these keys. Check both S3 keys, and that they are allowed to use this bucket.' };
    }
    if (status === 404) return { state: 'error', message: 'No bucket with that name at this address. Check S3_BUCKET and S3_ENDPOINT.' };
    if (status === 301 || status === 400) {
      return { state: 'error', message: 'Wrong region or address for this bucket. Check S3_REGION and S3_ENDPOINT.' };
    }
    return { state: 'error', message: `The storage service answered with an error (HTTP ${status}).` };
  } catch {
    return { state: 'error', message: 'Could not reach the storage service. Check S3_ENDPOINT.' };
  }
}

/* ------------------------------- the list -------------------------------- */

const CONNECTIONS: Record<ConnectionId, Connection> = {
  openai: aiProvider(
    'openai',
    'OpenAI',
    'Runs every bot unless one is switched to another provider. Also draws images and indexes the Knowledgebase.',
    'OPENAI_API_KEY',
    [
      { key: 'openai_organization', label: 'Organization ID (optional)', type: 'string', placeholder: 'org-…', hint: schemaHelp('openai_organization') },
      { key: 'openai_project', label: 'Project ID (optional)', type: 'string', placeholder: 'proj_…', hint: schemaHelp('openai_project') },
    ],
  ),
  anthropic: aiProvider('anthropic', 'Anthropic', 'Claude models. Only used by bots switched to Anthropic.', 'ANTHROPIC_API_KEY'),
  google: aiProvider(
    'google',
    'Google (Gemini)',
    'Gemini models, for bots switched to Google — and pictures, if a Gemini image model is marked Stable.',
    'GOOGLE_API_KEY',
  ),
  openrouter: aiProvider(
    'openrouter',
    'OpenRouter',
    'One key for hundreds of models from many companies. Only used by bots switched to OpenRouter.',
    'OPENROUTER_API_KEY',
  ),
  ollama: {
    id: 'ollama',
    title: 'Ollama (this server)',
    description: 'Free models running on this server. Slow — for experiments, not for customers. No key, only an address.',
    fields: [
      {
        key: 'ollama_base_url',
        label: 'Address',
        type: 'string',
        format: 'url',
        placeholder: 'http://localhost:11434/v1',
        hint: 'Leave blank to use the server default.',
      },
    ],
    env: [{ name: 'OLLAMA_BASE_URL' }],
    fetchLabel: 'Fetch models',
    test: () => testAiProvider('ollama'),
    fetch: () => fetchAiModels('ollama'),
  },
  stability: aiProvider(
    'stability',
    'Stability AI',
    'Pictures. Test checks the key and how many credits are left — it does not draw anything.',
    'STABILITY_API_KEY',
  ),
  tavily: {
    id: 'tavily',
    title: 'Tavily — web search',
    description: 'Lets bots with the web search tool look things up. Test runs one search, which uses one search credit.',
    fields: [{ key: 'tavily_api_key', label: 'API key', type: 'secret' }],
    env: [{ name: 'TAVILY_API_KEY' }],
    primary: { setting: 'tavily_api_key', env: 'TAVILY_API_KEY' },
    test: testTavily,
  },
  elevenlabs: {
    id: 'elevenlabs',
    title: 'ElevenLabs — voice',
    description: "Natural read-aloud and dictation in every browser. Without it, the browser's own voice is used.",
    fields: [{ key: 'elevenlabs_api_key', label: 'API key', type: 'secret' }],
    env: [{ name: 'ELEVENLABS_API_KEY' }],
    primary: { setting: 'elevenlabs_api_key', env: 'ELEVENLABS_API_KEY' },
    fetchLabel: 'Fetch voices',
    chooseLabel: 'Default voice',
    chosenSetting: 'elevenlabs_voice_id',
    chosenDefault: DEFAULT_VOICE_ID,
    test: testElevenLabs,
    fetch: fetchElevenLabsVoices,
    choose: chooseElevenLabsVoice,
  },
  resend: {
    id: 'resend',
    title: 'Resend — email',
    description: 'Sends sign-up, password and receipt emails. Without a key and a From address, mail is only written to the server log.',
    fields: [{ key: 'resend_api_key', label: 'API key', type: 'secret' }],
    env: [{ name: 'RESEND_API_KEY' }],
    primary: { setting: 'resend_api_key', env: 'RESEND_API_KEY' },
    fetchLabel: 'Fetch domains',
    test: testResend,
    fetch: fetchResendDomains,
  },
  stripe: {
    id: 'stripe',
    title: 'Stripe — cards',
    description: 'Card payments. Test checks the secret key and counts the products on the account — nothing is charged.',
    fields: [],
    envOnly: true,
    env: [{ name: 'STRIPE_SECRET_KEY', required: true }, { name: 'STRIPE_WEBHOOK_SECRET' }],
    test: testStripe,
  },
  paypal: {
    id: 'paypal',
    title: 'PayPal',
    description: 'PayPal payments. Test asks PayPal for a sign-in token with the app credentials — nothing is charged.',
    fields: [],
    envOnly: true,
    env: [
      { name: 'PAYPAL_CLIENT_ID', required: true },
      { name: 'PAYPAL_CLIENT_SECRET', required: true },
      { name: 'PAYPAL_WEBHOOK_ID' },
      { name: 'PAYPAL_MODE' },
    ],
    note: () => (process.env.PAYPAL_MODE === 'live' ? 'Live mode — real money.' : 'Sandbox mode — test money only.'),
    test: testPayPal,
  },
  s3: {
    id: 's3',
    title: 'S3 bucket',
    description: "Keeps uploaded and generated images in a bucket (AWS, Cloudflare R2, MinIO…) instead of on this server's disk.",
    fields: [],
    envOnly: true,
    env: [
      { name: 'S3_BUCKET', required: true },
      { name: 'S3_ACCESS_KEY_ID', required: true },
      { name: 'S3_SECRET_ACCESS_KEY', required: true },
      { name: 'S3_ENDPOINT', required: true },
      { name: 'S3_REGION' },
      { name: 'S3_PUBLIC_BASE_URL' },
      { name: 'MEDIA_STORE' },
    ],
    note: () =>
      process.env.MEDIA_STORE === 's3'
        ? 'Uploads go to the bucket.'
        : "Uploads go to this server's disk — right for a single server. Set MEDIA_STORE=s3 to switch.",
    test: testS3,
  },
};

export function getConnection(id: ConnectionId): Connection {
  return CONNECTIONS[id];
}

/* ------------------------------ remembered ------------------------------- */

const testKey = (id: ConnectionId) => `conn_test:${id}`;

const storedTestSchema = z.object({ state: z.enum(TEST_STATES), message: z.string(), at: z.string() });

export function readStoredTest(settings: Map<string, SettingValue>, id: ConnectionId): StoredTest | null {
  const parsed = storedTestSchema.safeParse(settings.get(testKey(id)));
  return parsed.success ? parsed.data : null;
}

/**
 * Belt and braces for "never the key": a provider that echoes part of a key
 * in its error text would otherwise have it written into `settings` and shown
 * on every later page load.
 */
function scrub(message: string): string {
  // The shapes real keys take here: sk-/sk_ (OpenAI, Anthropic, OpenRouter,
  // ElevenLabs, Stripe), rk_/pk_ (Stripe), re_ (Resend), tvly- (Tavily),
  // AIza (Google). The separator is required so ordinary words are left alone.
  return message.replace(/\b(?:(?:sk|rk|pk)[-_]|re_|tvly-|AIza)[A-Za-z0-9_*-]{16,}/g, '[key hidden]');
}

export async function rememberTest(id: ConnectionId, result: TestResult): Promise<StoredTest> {
  const stored: StoredTest = { state: result.state, message: scrub(result.message), at: new Date().toISOString() };
  await upsertSetting(testKey(id), JSON.stringify(stored), 'json', 'connections');
  return stored;
}

/** A saved change makes the last answer stale — it was about a different key. */
export async function forgetTest(id: ConnectionId) {
  await deleteSetting(testKey(id));
}

/** Runs a connection's check. Never throws — a check that crashes still has to say something. */
export async function runTest(id: ConnectionId): Promise<TestResult> {
  try {
    return await CONNECTIONS[id].test();
  } catch {
    return { state: 'error', message: 'The check itself failed. Try again, and look at the server log if it keeps happening.' };
  }
}

/* ------------------------------- for pages ------------------------------- */

export type ConnectionView = {
  id: ConnectionId;
  title: string;
  description: string;
  fields: ConnectionFieldView[];
  configured: boolean;
  /** Where the working value comes from, so the card can say "from the server file" rather than imply it was saved here. */
  source: 'saved' | 'env' | 'default' | null;
  envOnly: boolean;
  envVars: { name: string; present: boolean; required: boolean }[];
  note?: string;
  lastTest: StoredTest | null;
  fetchLabel?: string;
  chooseLabel?: string;
  chosenId?: string;
  canFetch: boolean;
  canChoose: boolean;
};

const present = (value: SettingValue | undefined) => typeof value === 'string' ? value.length > 0 : Boolean(value);

/**
 * Everything a card shows, and nothing it must not: secrets become "saved or
 * not", env vars become "set or not". Values only travel for plain fields the
 * owner typed in themselves (the OpenAI org ID, the Ollama address).
 */
export function connectionView(id: ConnectionId, settings: Map<string, SettingValue>): ConnectionView {
  const connection = CONNECTIONS[id];
  const envVars = connection.env.map((item) => ({
    name: item.name,
    present: Boolean(process.env[item.name]),
    required: Boolean(item.required),
  }));

  let configured: boolean;
  let source: ConnectionView['source'];
  if (connection.envOnly) {
    configured = envVars.filter((item) => item.required).every((item) => item.present);
    source = configured ? 'env' : null;
  } else if (connection.primary) {
    const saved = connection.primary.setting ? present(settings.get(connection.primary.setting)) : false;
    const fromEnv = connection.primary.env ? Boolean(process.env[connection.primary.env]) : false;
    configured = saved || fromEnv;
    source = saved ? 'saved' : fromEnv ? 'env' : null;
  } else {
    // Ollama: always has an address to try — saved here, from the env file,
    // or the row's built-in default, in the order a chat resolves it.
    configured = true;
    source = connection.fields.some((field) => present(settings.get(field.key)))
      ? 'saved'
      : envVars.some((item) => item.present)
        ? 'env'
        : 'default';
  }

  return {
    id,
    title: connection.title,
    description: connection.description,
    fields: connection.fields.map((field) =>
      field.type === 'secret'
        ? { ...field, saved: present(settings.get(field.key)) }
        : { ...field, value: String(settings.get(field.key) ?? '') },
    ),
    configured,
    source,
    envOnly: Boolean(connection.envOnly),
    envVars,
    note: connection.note?.(),
    lastTest: readStoredTest(settings, id),
    fetchLabel: connection.fetchLabel,
    chooseLabel: connection.chooseLabel,
    chosenId: connection.chosenSetting
      ? String(settings.get(connection.chosenSetting) || connection.chosenDefault || '')
      : undefined,
    canFetch: Boolean(connection.fetch),
    canChoose: Boolean(connection.choose),
  };
}

export { groupFor as settingsGroupFor };
