import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { knowledgeSources } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Hint, Checkbox } from '@/components/ui/field';
import { createKnowledgeSourceAction, updateKnowledgeSourceAction, deleteKnowledgeSourceAction } from '@/server/actions/admin-knowledge-sources';
import { TestButton } from './test-button';

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
        <div className="space-y-4 lg:col-span-2">
          {sources.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-slate-400">No knowledge sources configured yet.</p>
            </Card>
          ) : (
            sources.map((source) => (
              <Card key={source.id}>
                <CardContent className="space-y-3 p-5">
                  <form action={updateKnowledgeSourceAction} className="space-y-3">
                    <input type="hidden" name="id" value={source.id} />

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{source.label}</p>
                        <p className="text-xs text-slate-400">
                          key: <code className="font-mono">{source.key}</code>
                        </p>
                      </div>
                      <Badge tone={source.isActive ? 'green' : 'slate'}>{source.isActive ? 'active' : 'inactive'}</Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`baseUrl-${source.id}`}>Base URL</Label>
                        <Input id={`baseUrl-${source.id}`} name="baseUrl" defaultValue={source.baseUrl} className="text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`path-${source.id}`}>Path</Label>
                        <Input id={`path-${source.id}`} name="path" defaultValue={source.path} className="text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`label-${source.id}`}>Label</Label>
                        <Input id={`label-${source.id}`} name="label" defaultValue={source.label} className="text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`apiKey-${source.id}`}>API key</Label>
                        <Input
                          id={`apiKey-${source.id}`}
                          name="apiKey"
                          type="password"
                          placeholder={source.apiKey ? '•••••••• (leave blank to keep)' : 'not set'}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`grant-${source.id}`}>Grant (optional)</Label>
                        <Input id={`grant-${source.id}`} name="grant" placeholder={source.grant ? '•••••••• (leave blank to keep)' : 'not set'} className="text-xs" />
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-500">
                        <Checkbox name="isActive" value="true" defaultChecked={source.isActive} />
                        Active (selectable on personas)
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <Label htmlFor={`resultsPath-${source.id}`}>Results path</Label>
                        <Input id={`resultsPath-${source.id}`} name="resultsPath" defaultValue={source.resultsPath} className="font-mono text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`titlePath-${source.id}`}>Title path</Label>
                        <Input id={`titlePath-${source.id}`} name="titlePath" defaultValue={source.titlePath} className="font-mono text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`textPath-${source.id}`}>Text path</Label>
                        <Input id={`textPath-${source.id}`} name="textPath" defaultValue={source.textPath} className="font-mono text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`citationPath-${source.id}`}>Citation path</Label>
                        <Input id={`citationPath-${source.id}`} name="citationPath" defaultValue={source.citationPath} className="font-mono text-xs" />
                      </div>
                    </div>
                    <Hint>
                      Dot-paths into each hit in the response, e.g. a hit shaped <code className="font-mono">{'{ chunk: { text, title } }'}</code> needs
                      text path <code className="font-mono">chunk.text</code>.
                    </Hint>

                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button type="submit" className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700">
                        Save
                      </button>
                    </div>
                  </form>

                  <TestButton sourceKey={source.key} />

                  <form action={deleteKnowledgeSourceAction} className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <input type="hidden" name="id" value={source.id} />
                    <button type="submit" className="text-xs font-medium text-rose-500 hover:underline">
                      Delete
                    </button>
                  </form>
                </CardContent>
              </Card>
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
