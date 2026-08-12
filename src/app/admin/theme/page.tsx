import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { themes } from '@/db/schema';
import { Palette } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineForm } from '@/components/admin/inline-form';
import { ThemeForm } from '@/components/admin/theme-form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { createThemeAction, activateThemeAction, duplicateThemeAction, deleteThemeAction } from '@/server/actions/admin-branding';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branding' };

/**
 * The first few brand stops of a saved theme, as a stack of chips.
 *
 * Reads straight from `tokens` — the same map the root layout injects — so it
 * cannot drift from what the theme actually renders. Falls back to a neutral
 * placeholder for a theme that has not been given a palette yet, rather than
 * inventing a colour.
 */
function ThemeSwatch({ tokens }: { tokens: Record<string, string> | null }) {
  const stops = ['brand-500', 'brand-700', 'accent-500'];
  const colours = stops.map((stop) => tokens?.[stop]).filter(Boolean) as string[];

  if (colours.length === 0) {
    return <span className="size-6 shrink-0 rounded-lg border border-dashed border-white/20" aria-hidden />;
  }

  return (
    <span className="flex shrink-0 overflow-hidden rounded-lg border border-white/10" aria-hidden>
      {colours.map((colour, i) => (
        <span key={i} className="size-6" style={{ background: colour }} />
      ))}
    </span>
  );
}

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
          {allThemes.length === 0 ? (
            <EmptyState
              icon={Palette}
              title="No themes saved"
              description="A theme holds the palette, logo, favicon and fonts for the public site. Create one with the form beside this list — the composer generates a full colour ramp from a seed."
            />
          ) : null}
          {allThemes.map((theme) => (
            <Card key={theme.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    {/* A branding screen that showed no colours. The palette is
                        the thing that distinguishes one saved theme from
                        another, and it was only visible by expanding the form
                        and reading hex codes. */}
                    <ThemeSwatch tokens={theme.tokens} />
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
