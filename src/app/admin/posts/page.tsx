import type { Metadata } from 'next';

import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, posts, users } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { FormFold } from '@/components/admin/form-fold';
import { PostsList, type PostRow } from './posts-list';
import { Input, Textarea, Label, Select, Checkbox, Hint } from '@/components/ui/field';
import { savePostAction } from '@/server/actions/admin';
import { isScheduled } from '@/lib/blog/visibility';
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

  const items: PostRow[] = rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    isPublished: post.isPublished,
    isScheduled: isScheduled(post),
    publishedLabel: post.publishedAt ? formatDate(post.publishedAt) : '—',
    views: post.views,
    authorName: post.authorName,
    categoryName: post.categoryName,
  }));

  return (
    <div>
      <PageHeader title="Blog posts" description="Markdown content published on the public blog." />

      <PostsList
        rows={items}
        form={
          <FormFold title="New post" defaultOpen={items.length === 0}>
            <InlineForm bare action={savePostAction} title="New post" submitLabel="Publish post">
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
          </FormFold>
        }
      />
    </div>
  );
}
