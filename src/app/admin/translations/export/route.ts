import { requireAdmin } from '@/lib/auth';
import { buildExportRows, toJson, toCsv, toSql, isExportFormat } from '@/lib/i18n/export';

const CONTENT_TYPES = {
  json: 'application/json',
  csv: 'text/csv; charset=utf-8',
  sql: 'application/sql; charset=utf-8',
} as const;

/**
 * The export button. `?locale=pl&format=csv` — English on the left, the
 * target language on the right, in whichever of the three formats suits the
 * person receiving it (see src/lib/i18n/export.ts for the contract).
 */
export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const locale = (url.searchParams.get('locale') ?? '').trim().toLowerCase();
  const formatRaw = url.searchParams.get('format') ?? 'json';

  if (!/^[a-z]{2,10}$/.test(locale) || locale === 'en') {
    return new Response('Pass ?locale=<code> for a non-English locale — English is the source, not a translation.', {
      status: 400,
    });
  }
  if (!isExportFormat(formatRaw)) {
    return new Response('Unknown format — use json, csv or sql.', { status: 400 });
  }

  const rows = await buildExportRows(locale);
  const body =
    formatRaw === 'json' ? toJson(rows, locale) : formatRaw === 'csv' ? toCsv(rows, locale) : toSql(rows, locale);

  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPES[formatRaw],
      'Content-Disposition': `attachment; filename="translations-${locale}-${Date.now()}.${formatRaw}"`,
    },
  });
}
