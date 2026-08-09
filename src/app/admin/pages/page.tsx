import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutGrid, Trash2 } from 'lucide-react';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Textarea, Label, Checkbox } from '@/components/ui/field';
import { deletePageAction, savePageAction } from '@/server/actions/admin';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pages' };

export default async function AdminPagesPage() {
  const rows = await db.select().from(pages).orderBy(asc(pages.position));


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

        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH>URL</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>No pages yet.</EmptyRow>
              ) : (
                rows.map((page) => (
                  <TR key={page.id}>
                    <TD className="font-medium">
                      {page.title}
                      {page.isLocked ? <Badge className="ml-1">locked</Badge> : null}
                    </TD>
                    <TD>
                      <code className="text-xs text-slate-400">/{page.slug}</code>
                    </TD>
                    <TD>
                      <Badge tone={page.isPublished ? 'green' : 'slate'}>
                        {page.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/pages/${page.id}/builder`}
                        title="Open the block builder"
                        className="mr-1 inline-grid size-8 place-items-center rounded-lg align-middle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <LayoutGrid className="size-4" />
                      </Link>
                      {page.isLocked ? null : (
                        <form action={deletePageAction} className="inline">
                          <input type="hidden" name="id" value={page.id} />
                          <button
                            type="submit"
                            className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </form>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
