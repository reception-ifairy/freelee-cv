import type { Metadata } from 'next';

import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { formatDate } from '@/lib/utils';
import { PagesList, type PageRow } from './pages-list';
import { Input, Textarea, Label, Checkbox } from '@/components/ui/field';
import { savePageAction } from '@/server/actions/admin';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pages' };

export default async function AdminPagesPage() {
  const view = await getAdminView('pages');
  const rows = await db.select().from(pages).orderBy(asc(pages.position));

  const items: PageRow[] = rows.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    isPublished: page.isPublished,
    isLocked: page.isLocked,
    noindex: page.noindex,
    useBuilder: page.useBuilder,
    updatedLabel: formatDate(page.updatedAt),
  }));


  return (
    <div>
      <PageHeader title="Pages" description="Static content such as About, Terms and Privacy." />

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={savePageAction} title="New page" submitLabel="Save page">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" placeholder="auto-generated" className="font-mono text-xs" />
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" name="content" rows={10} className="font-mono text-xs" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isPublished" defaultChecked /> Published
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="noindex" /> Hide from search engines
          </label>
        </InlineForm>

        <div className="lg:col-span-2">
          <PagesList rows={items} view={view} />
        </div>
      </div>
    </div>
  );
}
