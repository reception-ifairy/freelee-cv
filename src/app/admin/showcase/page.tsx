import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, showcaseItems } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Label, Select, Checkbox, Hint } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { listPromotableMessages } from '@/lib/showcase/queries';
import { saveShowcaseItemAction } from '@/server/actions/admin-showcase';
import { ShowcaseList, type ShowcaseRow } from './showcase-list';
import { PromotePanel } from './promote-panel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Showcase' };

export default async function AdminShowcasePage() {
  const [rows, personaRows, candidates, view] = await Promise.all([
    db
      .select({
        id: showcaseItems.id,
        title: showcaseItems.title,
        caption: showcaseItems.caption,
        mediaUrl: showcaseItems.mediaUrl,
        prompt: showcaseItems.prompt,
        showPrompt: showcaseItems.showPrompt,
        isVisible: showcaseItems.isVisible,
        personaName: personas.name,
      })
      .from(showcaseItems)
      .leftJoin(personas, eq(personas.id, showcaseItems.personaId))
      .orderBy(asc(showcaseItems.position), asc(showcaseItems.id)),
    db.select({ id: personas.id, name: personas.name }).from(personas).where(eq(personas.isActive, true)).orderBy(asc(personas.name)),
    listPromotableMessages(24),
    getAdminView('showcase'),
  ]);

  const items: ShowcaseRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    caption: row.caption,
    mediaUrl: row.mediaUrl,
    personaName: row.personaName,
    hasPrompt: Boolean(row.prompt),
    showPrompt: row.showPrompt,
    isVisible: row.isVisible,
  }));

  return (
    <div>
      <PageHeader
        title="Showcase"
        description="Curated examples of what your assistants produce, shown by the Showcase block. See docs/38-showcase.md."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={saveShowcaseItemAction} title="Add a piece" submitLabel="Add to showcase">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required maxLength={120} placeholder="Poster for a bakery" />
          </div>
          <div>
            <Label htmlFor="mediaUrl">Image *</Label>
            <Input id="mediaUrl" name="mediaUrl" required placeholder="https://… or /uploads/…" className="font-mono text-xs" />
            <Hint>A full URL, or a path starting with / for something already on this server.</Hint>
          </div>
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea id="caption" name="caption" rows={2} maxLength={400} />
          </div>
          <div>
            <Label htmlFor="personaId">Made by</Label>
            <Select id="personaId" name="personaId" defaultValue="">
              <option value="">No persona</option>
              {personaRows.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Label htmlFor="prompt" className="mb-0">The ask</Label>
              <HelpTip
                title="The ask"
                body="What was asked for. Showing it turns a nice picture into a demonstration of the product — but never publish a real customer's wording without reading it first."
              />
            </div>
            <Textarea id="prompt" name="prompt" rows={2} maxLength={2000} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="showPrompt" defaultChecked /> Show the ask on the site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isVisible" defaultChecked /> Visible
          </label>
        </InlineForm>

        <div className="lg:col-span-2">
          <ShowcaseList rows={items} view={view} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Promote real work
        </h2>
        <p className="mb-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Images your personas have actually generated. Nothing here is public until you add it, and the ask
          is hidden by default so you can read it first.
        </p>
        <PromotePanel candidates={candidates} />
      </div>
    </div>
  );
}
