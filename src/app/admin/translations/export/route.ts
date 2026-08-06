import { db } from '@/db';
import { translations } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';

/** The "export button" — same shape as scripts/export-translations.ts, as an admin-only download. */
export async function GET() {
  await requireAdmin();

  const rows = await db
    .select({ namespace: translations.namespace, key: translations.key, locale: translations.locale, value: translations.value })
    .from(translations)
    .orderBy(translations.namespace, translations.locale, translations.key);

  return new Response(JSON.stringify(rows, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="translations-export-${Date.now()}.json"`,
    },
  });
}
