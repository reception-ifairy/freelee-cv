import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { knowledgeSources } from '@/db/schema';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Input, Label, Hint } from '@/components/ui/field';
import { createKnowledgeSourceAction } from '@/server/actions/admin-knowledge-sources';
import { SourceCard } from './source-card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Knowledge sources' };

export default async function KnowledgeSourcesPage() {
  const sources = await db.select().from(knowledgeSources).orderBy(asc(knowledgeSources.label));

  return (
    <div>
      <PageHeader
        title="Knowledge sources"
        description={
          'Any REST/JSON search API a persona can cite from — POST {baseUrl}{path} with ' +
          '{query, grant, k}, a Bearer key, and a results array your dot-paths point into. ' +
          'Add one here, no deploy. See docs/18-knowledge-sources.md.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {sources.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                  icon={Search}
                  title="No knowledge sources"
                  description="A knowledge source is an external search API a persona can cite from. Add one with the form beside this list — the response mapping is dot-paths, so most simple REST search APIs work without code."
                  className="border-0 py-8"
                />
            </Card>
          ) : (
            sources.map((source) => (
              <SourceCard
                key={source.id}
                source={{
                  id: source.id,
                  key: source.key,
                  label: source.label,
                  baseUrl: source.baseUrl,
                  path: source.path,
                  // Booleans only: the card is a client component, and a key
                  // passed as a prop would be in the page's HTML.
                  hasApiKey: Boolean(source.apiKey),
                  hasGrant: Boolean(source.grant),
                  resultsPath: source.resultsPath,
                  titlePath: source.titlePath,
                  textPath: source.textPath,
                  citationPath: source.citationPath,
                  isActive: source.isActive,
                }}
              />
            ))
          )}
        </div>

        <InlineForm action={createKnowledgeSourceAction} title="Add a source" submitLabel="Add source">
          <div>
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" required placeholder="My Docs Search" />
          </div>
          <div>
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input id="baseUrl" name="baseUrl" required placeholder="https://docs.example.com" />
          </div>
          <div>
            <Label htmlFor="path">Path</Label>
            <Input id="path" name="path" defaultValue="/v1/search" />
          </div>
          <div>
            <Label htmlFor="apiKey">API key</Label>
            <Input id="apiKey" name="apiKey" type="password" placeholder="Sent as Authorization: Bearer …" />
          </div>
          <div>
            <Label htmlFor="grant">Grant (optional)</Label>
            <Input id="grant" name="grant" placeholder="Extra field some APIs expect alongside query" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="resultsPath">Results path</Label>
              <Input id="resultsPath" name="resultsPath" defaultValue="data.results" className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="titlePath">Title path</Label>
              <Input id="titlePath" name="titlePath" defaultValue="title" className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="textPath">Text path</Label>
              <Input id="textPath" name="textPath" defaultValue="text" className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="citationPath">Citation path</Label>
              <Input id="citationPath" name="citationPath" defaultValue="sourceUrl" className="font-mono text-xs" />
            </div>
          </div>
          <Hint>
            Expects <code className="font-mono">POST {'{baseUrl}{path}'}</code> with body{' '}
            <code className="font-mono">{'{query, grant, k}'}</code>, response containing an array of hits at "results
            path". Simple REST/JSON search APIs only — see docs/18-knowledge-sources.md.
          </Hint>
        </InlineForm>
      </div>
    </div>
  );
}
