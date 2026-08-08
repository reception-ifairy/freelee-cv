/**
 * Reads the word bank (scripts/extract-translations.ts's output) and asks
 * whichever AI provider the platform is configured to use to translate it,
 * then upserts the result into `translations` (never English — see the
 * schema comment on that table). Builds its own raw Drizzle client rather
 * than importing `@/lib/ai/registry` or `@/db` directly — both import
 * `server-only`, which throws outside a Next.js server context (the same
 * constraint every script in this project hits; see e.g.
 * scripts/seed-ai-models.ts).
 *
 *   npx tsx scripts/translate-bank.ts --locale=pl              # every module
 *   npx tsx scripts/translate-bank.ts --locale=pl --module=blog # just one
 *
 * Translates **one module per request** (see src/lib/i18n/namespaces.ts for
 * why): a single request carrying the whole product drifts and drops keys as
 * it grows, and a failure in one module would take the rest down with it.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as schema from '../src/db/schema';
import { translations, locales } from '../src/db/schema';
import { ALL_NAMESPACES, NAMESPACE_LABELS, bankPath, isNamespace } from '../src/lib/i18n/namespaces';
import type { Namespace } from '../src/lib/i18n/namespaces';

const LOCALE_NAMES: Record<string, string> = { en: 'English', pl: 'Polish' };

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
}

async function main() {
  const targetLocale = arg('locale') ?? 'pl';
  const only = arg('module');

  if (targetLocale === 'en') {
    console.error('Refusing to translate into "en" — English is the bank itself, never a translations row (see docs/17-translations.md).');
    process.exit(1);
  }
  let modules: Namespace[] = [...ALL_NAMESPACES];
  if (only) {
    if (!isNamespace(only)) {
      console.error(`Unknown module "${only}". Known: ${ALL_NAMESPACES.join(', ')}`);
      process.exit(1);
    }
    modules = [only];
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  // Resolves the provider the same way /admin/translations does — from the
  // `ai_default_provider` setting — instead of assuming OpenAI. Hardcoding it
  // here meant the CLI and the admin panel could disagree about which AI was
  // doing the work, which is exactly the confusion that showed up when the
  // OpenAI account ran out of credit and the panel had already moved to Google.
  const [setting] = await client`select value from settings where key = 'ai_default_provider'`;
  const providerKey = (setting?.value as string) || 'openai';

  const [provider] = await client`
    select api_key_env, default_model from ai_providers where key = ${providerKey}`;
  if (!provider) throw new Error(`No '${providerKey}' row in ai_providers — run npm run db:seed-ai-models first.`);

  // Settings first, env second — the same precedence getModel() uses.
  const [keyRow] = await client`select value from settings where key = ${`${providerKey}_api_key`}`;
  const apiKey = (keyRow?.value as string) || process.env[provider.api_key_env as string];
  if (!apiKey) throw new Error(`No API key for '${providerKey}' (settings or ${provider.api_key_env}).`);

  const [modelRow] = await client`
    select m.model_id from ai_models m
    join ai_providers p on p.id = m.provider_id
    where p.key = ${providerKey} and m.tier = 'balanced' and m.status = 'stable' limit 1`;
  const modelId = (modelRow?.model_id as string) || (provider.default_model as string);

  const targetName = LOCALE_NAMES[targetLocale] ?? targetLocale;
  const model =
    providerKey === 'anthropic'
      ? createAnthropic({ apiKey })(modelId)
      : providerKey === 'google'
        ? createGoogleGenerativeAI({ apiKey })(modelId)
        : createOpenAI({ apiKey })(modelId);

  console.log(`Using ${providerKey} / ${modelId}\n`);

  let upserted = 0;
  let skipped = 0;
  let total = 0;
  const failures: string[] = [];

  for (const namespace of modules) {
    let bank: Record<string, string>;
    try {
      bank = JSON.parse(await readFile(bankPath(namespace), 'utf8'));
    } catch {
      continue; // no bank file for this module — nothing to do
    }
    const keys = Object.keys(bank);
    if (keys.length === 0) continue;
    total += keys.length;

    console.log(`  ${NAMESPACE_LABELS[namespace].padEnd(18)} ${String(keys.length).padStart(4)} key(s) → ${targetName}…`);

    let translated: Record<string, string>;
    try {
      const { text } = await generateText({
        model,
        system:
          `You are a professional UI/UX localizer for a modern SaaS product. You are translating the ` +
          `"${NAMESPACE_LABELS[namespace]}" section of its interface from English into ${targetName}. ` +
          `Produce natural, idiomatic phrasing a native speaker would actually write in a product UI, not a ` +
          `literal word-for-word translation. Keep every {placeholder} token (e.g. {count}, {credits}, ` +
          `{year}, {siteName}, {minutes}, {date}) exactly as-is, spelled identically. Keep UI labels short — ` +
          `a button label that doubles in length breaks the layout. Return ONLY a JSON object with the exact ` +
          `same keys and translated string values — no markdown code fences, no commentary, no extra keys, ` +
          `no missing keys.`,
        prompt: JSON.stringify(bank, null, 2),
      });
      translated = JSON.parse(stripCodeFence(text));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`    ✗ ${namespace} failed: ${message}`);
      failures.push(namespace);
      continue;
    }

    for (const key of keys) {
      const value = translated[key];
      if (typeof value !== 'string' || !value.trim()) {
        console.warn(`    ⚠ Missing "${key}" — skipped, English fallback still applies at render time.`);
        skipped += 1;
        continue;
      }
      await db
        .insert(translations)
        .values({ namespace, key, locale: targetLocale, value })
        .onConflictDoUpdate({
          target: [translations.namespace, translations.key, translations.locale],
          set: { value, updatedAt: new Date() },
        });
      upserted += 1;
    }
  }

  // Only unfreeze when nothing failed — a half-translated language must not
  // reach the live site (same rule /admin/translations enforces).
  const status = failures.length === 0 && upserted > 0 ? 'active' : 'pending';
  await db
    .insert(locales)
    .values({ code: targetLocale, name: targetName, status })
    .onConflictDoUpdate({ target: locales.code, set: { status } });

  console.log(
    `\nDone — ${upserted} upserted, ${skipped} skipped (of ${total}). ` +
      (failures.length > 0
        ? `Failed module(s): ${failures.join(', ')}. Locale "${targetLocale}" left pending (frozen).`
        : `Locale "${targetLocale}" is active.`),
  );
  await client.end();
}

main().catch((error) => {
  console.error('Translation failed:', error);
  process.exit(1);
});
