import type { Metadata } from 'next';
import { desc, eq, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { db } from '@/db';
import { locales, translations } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { setActiveLocaleAction } from '@/server/actions/admin-translations';
import { ALL_NAMESPACES, NAMESPACE_LABELS, bankPath } from '@/lib/i18n/namespaces';
import type { Namespace } from '@/lib/i18n/namespaces';
import { getAdminT } from '@/lib/i18n/translate';
import { helpTopics } from '@/lib/help/topics';
import { HelpTip } from '@/components/ui/help-tip';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddLanguageForm, RetryButton, ImportForm, ExportPanel } from './translations-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Translations' };

/** How many English strings each module contributes — read from the bank files, the English source of truth. */
async function bankSizes(): Promise<{ namespace: Namespace; total: number }[]> {
  const out: { namespace: Namespace; total: number }[] = [];
  for (const namespace of ALL_NAMESPACES) {
    try {
      const bank = JSON.parse(await readFile(bankPath(namespace), 'utf8'));
      out.push({ namespace, total: Object.keys(bank).length });
    } catch {
      out.push({ namespace, total: 0 });
    }
  }
  return out;
}

export default async function AdminTranslationsPage() {
  const [allLocales, frontendLocale, adminLocale, modules, counts, { t }] = await Promise.all([
    db.select().from(locales).orderBy(desc(locales.status), locales.name),
    getSettingString('frontend_locale', 'en'),
    getSettingString('admin_locale', 'en'),
    bankSizes(),
    db
      .select({ locale: translations.locale, namespace: translations.namespace, count: sql<number>`count(*)::int` })
      .from(translations)
      .groupBy(translations.locale, translations.namespace),
    getAdminT(),
  ]);

  const help = helpTopics(t);
  const active = allLocales.filter((l) => l.status === 'active');
  const pending = allLocales.filter((l) => l.status === 'pending');
  const translatable = allLocales.filter((l) => l.code !== 'en');
  const bankTotal = modules.reduce((sum, m) => sum + m.total, 0);

  const countOf = (locale: string, namespace: string) =>
    counts.find((c) => c.locale === locale && c.namespace === namespace)?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Translations"
        description="One admin-controlled language for the whole site — not a per-visitor preference. English is the source and is never stored; every other language is generated from it, module by module."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
              <CardDescription>
                Frontend: <strong>{frontendLocale}</strong> · Admin panel: <strong>{adminLocale}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {active.map((locale) => (
                <div
                  key={locale.code}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <p className="min-w-0 text-sm font-medium">
                    {locale.name} <span className="text-xs text-slate-400">({locale.code})</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="green">active</Badge>
                    <form action={setActiveLocaleAction}>
                      <input type="hidden" name="namespace" value="frontend" />
                      <input type="hidden" name="code" value={locale.code} />
                      <button
                        type="submit"
                        disabled={frontendLocale === locale.code}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {frontendLocale === locale.code ? 'Frontend ✓' : 'Set as frontend'}
                      </button>
                    </form>
                    <form action={setActiveLocaleAction}>
                      <input type="hidden" name="namespace" value="admin" />
                      <input type="hidden" name="code" value={locale.code} />
                      <button
                        type="submit"
                        disabled={adminLocale === locale.code}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {adminLocale === locale.code ? 'Admin ✓' : 'Set as admin'}
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              {pending.map((locale) => (
                <div
                  key={locale.code}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 px-2 py-2.5 dark:border-amber-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {locale.name} <span className="text-xs text-slate-400">({locale.code})</span>
                    </p>
                    <p className="text-xs text-slate-400">Frozen — not selectable until every module completes.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="amber">pending</Badge>
                    <RetryButton code={locale.code} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Word bank
                <HelpTip title={help['translations.bank'].title} body={help['translations.bank'].body} />
              </CardTitle>
              <CardDescription>
                {bankTotal} English string(s) across {modules.filter((m) => m.total > 0).length} module(s). Regenerate
                with <code className="font-mono">npm run i18n:extract</code> after changing any UI text.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                      <th className="pb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Module
                      </th>
                      <th className="pb-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        English
                      </th>
                      {translatable.map((l) => {
                        // Every number needed for this was already computed and
                        // only ever shown per-module — so the one question a
                        // reader actually has, "how far along is Polish", could
                        // only be answered by adding up a column by eye.
                        const done = modules.reduce((sum, m) => sum + countOf(l.code, m.namespace), 0);
                        const percent = bankTotal > 0 ? Math.round((done / bankTotal) * 100) : 0;

                        return (
                          <th
                            key={l.code}
                            className="pb-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                          >
                            {l.code}
                            <span
                              className={cn(
                                'ml-1.5 font-semibold',
                                percent === 100 ? 'text-emerald-400' : percent === 0 ? 'text-slate-600' : 'text-amber-400',
                              )}
                            >
                              {percent}%
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {modules
                      .filter((m) => m.total > 0)
                      .map((m) => (
                        <tr key={m.namespace} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                          <td className="py-2">{NAMESPACE_LABELS[m.namespace]}</td>
                          <td className="py-2 text-right font-mono text-xs text-slate-500">{m.total}</td>
                          {translatable.map((l) => {
                            const done = countOf(l.code, m.namespace);
                            return (
                              <td key={l.code} className="py-2 pl-3">
                                {/* Colour was on the text alone, so a module at
                                    2/40 and one at 39/40 were both just "amber".
                                    A track behind the number shows the distance
                                    without reading either figure. */}
                                <span className="flex items-center justify-end gap-2">
                                  <span className="h-1 w-10 overflow-hidden rounded-full bg-white/10">
                                    <span
                                      className={cn(
                                        'block h-full rounded-full',
                                        done >= m.total ? 'bg-emerald-500' : 'bg-amber-500',
                                      )}
                                      style={{ width: `${m.total > 0 ? (done / m.total) * 100 : 0}%` }}
                                    />
                                  </span>
                                  <span
                                    className={cn(
                                      'font-mono text-xs tabular-nums',
                                      done >= m.total
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : done === 0
                                          ? 'text-slate-300 dark:text-slate-600'
                                          : 'text-amber-600 dark:text-amber-400',
                                    )}
                                  >
                                    {done}/{m.total}
                                  </span>
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {translatable.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  English only right now. Add a language on the right to generate it from this bank.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add a language</CardTitle>
              <CardDescription>The AI translates each module in turn, then unfreezes the language.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddLanguageForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Export
                <HelpTip title={help['translations.export'].title} body={help['translations.export'].body} side="left" />
              </CardTitle>
              <CardDescription>English on the left, the target language on the right.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExportPanel locales={translatable.map((l) => ({ code: l.code, name: l.name }))} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>A reviewed export coming back from a translator.</CardDescription>
            </CardHeader>
            <CardContent>
              <ImportForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
