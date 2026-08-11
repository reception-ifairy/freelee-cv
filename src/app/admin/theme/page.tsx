import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { themes } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { ThemeForm } from '@/components/admin/theme-form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { createThemeAction, activateThemeAction, duplicateThemeAction, deleteThemeAction } from '@/server/actions/admin-branding';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branding' };

export default async function AdminBrandingPage() {
  const allThemes = await db.select().from(themes).orderBy(asc(themes.name));

  return (
    <div>
      <PageHeader
        title="Branding"
        description="Colours, logo, favicon and fonts — keep as many saved themes as you like, only one is live at a time. See docs/20-branding.md."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {allThemes.map((theme) => (
            <Card key={theme.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{theme.name}</p>
                    <Badge tone={theme.isActive ? 'green' : 'slate'}>{theme.isActive ? 'active' : 'inactive'}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {!theme.isActive ? (
                      <form action={activateThemeAction}>
                        <input type="hidden" name="id" value={theme.id} />
                        <button type="submit" className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700">
                          Set active
                        </button>
                      </form>
                    ) : null}
                    <form action={duplicateThemeAction}>
                      <input type="hidden" name="id" value={theme.id} />
                      <button type="submit" className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        Duplicate
                      </button>
                    </form>
                    {!theme.isActive ? (
                      <form action={deleteThemeAction}>
                        <input type="hidden" name="id" value={theme.id} />
                        <button type="submit" className="text-xs font-medium text-rose-500 hover:underline">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <ThemeForm theme={theme} />
              </CardContent>
            </Card>
          ))}
        </div>

        <InlineForm action={createThemeAction} title="New theme" submitLabel="Create theme">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Summer campaign" />
          </div>
        </InlineForm>
      </div>
    </div>
  );
}
