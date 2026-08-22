import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Textarea, Label, Hint } from '@/components/ui/field';
import { listCollections } from '@/lib/library/queries';
import { saveCollectionAction } from '@/server/actions/admin-knowledgebase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shelves' };

export default async function CollectionsPage() {
  const collections = await listCollections();

  return (
    <div>
      <Link
        href="/admin/knowledgebase"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> Knowledgebase
      </Link>

      <PageHeader
        title="Shelves"
        description="A shelf is what a bot is granted. Grant one and it can quote from every document on it."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-2 lg:col-span-2">
          {collections.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No shelves yet"
              description="Make a folder inside the library and put books in it — the folder becomes a shelf the next time you scan."
            />
          ) : null}

          {collections.map((c) => (
            <Card key={c.id} padding="sm" className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {c.description ?? `${c.documents} document(s), ${c.passages.toLocaleString()} passages`}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-400">{c.key}</p>
              </div>
              {c.fromFolder ? (
                <Badge tone="slate" title="Created automatically from a folder name.">from folder</Badge>
              ) : null}
              {!c.isActive ? <Badge tone="amber">off</Badge> : null}
            </Card>
          ))}
        </div>

        <InlineForm action={saveCollectionAction} title="New shelf" submitLabel="Create shelf">
          <div>
            <Label htmlFor="label">Name</Label>
            <Input id="label" name="label" required placeholder="UK employment law" />
            <Hint>
              Its address is set once, from this name, and never changes afterwards — personas are granted
              a shelf by address, so renaming one must not quietly revoke access.
            </Hint>
          </div>
          <div>
            <Label htmlFor="description">What is on it</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
        </InlineForm>
      </div>
    </div>
  );
}
