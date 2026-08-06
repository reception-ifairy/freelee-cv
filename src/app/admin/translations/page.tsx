import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { locales } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { setActiveLocaleAction } from '@/server/actions/admin-translations';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddLanguageForm, RetryButton, ImportForm } from './translations-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Translations' };

export default async function AdminTranslationsPage() {
  const [allLocales, frontendLocale, adminLocale] = await Promise.all([
    db.select().from(locales).orderBy(desc(locales.status), locales.name),
    getSettingString('frontend_locale', 'en'),
    getSettingString('admin_locale', 'en'),
  ]);

  const active = allLocales.filter((l) => l.status === 'active');
  const pending = allLocales.filter((l) => l.status === 'pending');

  return (
    <div>
      <PageHeader
        title="Translations"
        description="One admin-controlled language for the whole site — not a per-visitor preference."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Frontend: <strong>{frontendLocale}</strong> · Admin panel: <strong>{adminLocale}</strong> (not wired
              into any admin page yet)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.map((locale) => (
              <div key={locale.code} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {locale.name} <span className="text-xs text-slate-400">({locale.code})</span>
                  </p>
                </div>
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
              <div key={locale.code} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 px-2 py-2.5 dark:border-amber-800">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {locale.name} <span className="text-xs text-slate-400">({locale.code})</span>
                  </p>
                  <p className="text-xs text-slate-400">Frozen — not selectable until translation completes.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="amber">pending</Badge>
                  <RetryButton code={locale.code} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add a language</CardTitle>
              <CardDescription>AI translates every known string into it.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddLanguageForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup / coworker sync</CardTitle>
              <CardDescription>docs/17-translations.md, CONTRIBUTING.md §5</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href="/admin/translations/export"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Export translations
              </a>
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <ImportForm />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
