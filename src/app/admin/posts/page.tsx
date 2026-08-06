import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, posts, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Textarea, Label, Select, Checkbox, Hint } from '@/components/ui/field';
import { deletePostAction, savePostAction } from '@/server/actions/admin';
import { formatDate } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Blog posts' };

export default async function AdminPostsPage() {
  const [rows, categoryRows] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        isPublished: posts.isPublished,
        views: posts.views,
        publishedAt: posts.publishedAt,
        authorName: users.name,
        categoryName: categories.name,
      })
      .from(posts)
      .leftJoin(users, eq(users.id, posts.authorId))
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .orderBy(desc(posts.createdAt))
      .limit(50),
    db.select().from(categories).orderBy(categories.position),
  ]);

  return (
    <div>
      <PageHeader title="Blog posts" description="Markdown content published on the public blog." />

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={savePostAction} title="New post" submitLabel="Publish post">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea id="excerpt" name="excerpt" rows={2} />
          </div>
          <div>
            <Label htmlFor="content">Content *</Label>
            <Textarea id="content" name="content" rows={10} required className="font-mono text-xs" />
            <Hint>Markdown. Raw HTML is escaped when rendered.</Hint>
          </div>
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" name="categoryId" defaultValue="">
              <option value="">None</option>
              {categoryRows.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isPublished" defaultChecked /> Published
          </label>
        </InlineForm>

        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH className="text-right">Views</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>No posts yet.</EmptyRow>
              ) : (
                rows.map((post) => (
                  <TR key={post.id}>
                    <TD>
                      <p className="font-medium">{post.title}</p>
                      <p className="text-xs text-slate-400">
                        /{post.slug} · {formatDate(post.publishedAt)}
                      </p>
                    </TD>
                    <TD>{post.categoryName ?? '—'}</TD>
                    <TD className="text-right">{post.views.toLocaleString('en-US')}</TD>
                    <TD>
                      <Badge tone={post.isPublished ? 'green' : 'slate'}>
                        {post.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <form action={deletePostAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <button
                          type="submit"
                          className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
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
