/**
 * Reads a word bank (scripts/extract-translations.ts's output) and asks the
 * platform's own configured OpenAI provider to translate it in one batch,
 * then upserts the result into `translations` (never English — see the
 * schema comment on that table). Builds its own raw Drizzle client rather
 * than importing `@/lib/ai/registry` or `@/db` directly — both import
 * `server-only`, which throws outside a Next.js server context (the same
 * constraint every script in this project hits; see e.g.
 * scripts/seed-ai-models.ts).
 *
 *   npx tsx scripts/translate-bank.ts [--namespace=frontend] [--locale=pl] [--bank=i18n/frontend.en.json]
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as schema from '../src/db/schema';
import { translations, locales } from '../src/db/schema';

const LOCALE_NAMES: Record<string, string> = { en: 'English', pl: 'Polish' };

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
}

async function main() {
  const namespace = arg('namespace') ?? 'frontend';
  const targetLocale = arg('locale') ?? 'pl';
  const bankPath = arg('bank') ?? `i18n/${namespace}.en.json`;

  if (targetLocale === 'en') {
    console.error('Refusing to translate into "en" — English is the bank itself, never a translations row (see docs/17-translations.md).');
    process.exit(1);
  }

  const bank: Record<string, string> = JSON.parse(await readFile(bankPath, 'utf8'));
  const keys = Object.keys(bank);
  if (keys.length === 0) {
    console.log('Bank is empty — nothing to translate.');
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  const [provider] = await client`select api_key_env from ai_providers where key = 'openai'`;
  if (!provider) throw new Error("No 'openai' row in ai_providers — run npm run db:seed-ai-models first.");
  const apiKey = process.env[provider.api_key_env as string];
  if (!apiKey) throw new Error(`${provider.api_key_env} is not set.`);

  const targetName = LOCALE_NAMES[targetLocale] ?? targetLocale;
  const model = createOpenAI({ apiKey })('gpt-4o-mini');

  console.log(`Translating ${keys.length} key(s) (${namespace}) from English to ${targetName}…`);

  const { text } = await generateText({
    model,
    system:
      `You are a professional UI/UX localizer for a modern SaaS product. Translate the JSON object's ` +
      `values from English into ${targetName} — natural, idiomatic phrasing a native speaker would ` +
      `actually write in a product UI, not a literal word-for-word translation. Keep any {placeholder} ` +
      `tokens (e.g. {count}, {credits}, {year}, {siteName}) exactly as-is, unchanged, repositioned only ` +
      `if the target language's grammar requires it. Preserve the tone: confident, concise, modern. ` +
      `Return ONLY a JSON object with the exact same keys and translated string values — no markdown ` +
      `code fences, no commentary, no extra keys, no missing keys.`,
    prompt: JSON.stringify(bank, null, 2),
  });

  let translated: Record<string, string>;
  try {
    translated = JSON.parse(stripCodeFence(text));
  } catch (error) {
    console.error('Model did not return valid JSON:', text);
    throw error;
  }

  let upserted = 0;
  let skipped = 0;
  for (const key of keys) {
    const value = translated[key];
    if (!value) {
      console.warn(`⚠ Missing translation for "${key}" — skipped, English fallback still applies at render time.`);
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

  // Keeps this CLI path consistent with /admin/translations' pending/active
  // gating (src/lib/i18n/translate.ts) — a locale translated via this script
  // is a deliberate, complete action, not a partial one, so it goes
  // straight to 'active' rather than sitting 'pending' with nothing to
  // unfreeze it.
  await db
    .insert(locales)
    .values({ code: targetLocale, name: targetName, status: 'active' })
    .onConflictDoUpdate({ target: locales.code, set: { status: 'active' } });

  console.log(`Done — ${upserted} upserted, ${skipped} skipped (of ${keys.length}). Locale "${targetLocale}" is active.`);
  await client.end();
}

main().catch((error) => {
  console.error('Translation failed:', error);
  process.exit(1);
});
