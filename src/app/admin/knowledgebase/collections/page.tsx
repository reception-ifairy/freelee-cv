import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Label, Hint } from '@/components/ui/field';
import { listCollections } from '@/lib/library/queries';
import { saveCollectionAction } from '@/server/actions/admin-knowledgebase';
import { FormFold } from '@/components/admin/form-fold';
import { ShelvesList } from './shelves-list';

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

      <ShelvesList
        rows={collections.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          description: c.description ?? null,
          documents: Number(c.documents),
          passages: Number(c.passages),
          fromFolder: Boolean(c.fromFolder),
          isActive: Boolean(c.isActive),
        }))}
        form={
          <FormFold title="New shelf" defaultOpen={collections.length === 0}>
            <InlineForm bare action={saveCollectionAction} title="New shelf" submitLabel="Create shelf">
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
          </FormFold>
        }
      />
    </div>
  );
}
