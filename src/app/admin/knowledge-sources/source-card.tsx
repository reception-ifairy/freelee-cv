'use client';

import { useState, useTransition } from 'react';
import { Stethoscope } from 'lucide-react';
import {
  deleteKnowledgeSourceAction,
  testKnowledgeSourceAction,
  updateKnowledgeSourceAction,
  type SourceTestResult,
} from '@/server/actions/admin-knowledge-sources';
import type { ActionState } from '@/server/actions/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';
import { TestStatus } from '@/components/admin/test-status';

/** A source as the page may show it: whether a key or grant is saved, never the values. */
export type SourceCardData = {
  id: number;
  key: string;
  label: string;
  baseUrl: string;
  path: string;
  hasApiKey: boolean;
  hasGrant: boolean;
  resultsPath: string;
  titlePath: string;
  textPath: string;
  citationPath: string;
  isActive: boolean;
};

/**
 * One knowledge source: edit it, save it, test it — the same Save → Test flow
 * as the connection cards in Settings.
 *
 * Saving used to be a bare server-action form that returned nothing, so a
 * failed save (an invalid URL, or unticking "Active", which always failed)
 * looked exactly like a successful one. Test needed a query typed in first;
 * it now searches for the source's own label, and its answer lists what came
 * back — the knowledge-source equivalent of "Fetch".
 */
export function SourceCard({ source }: { source: SourceCardData }) {
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<ActionState>(null);
  const [result, setResult] = useState<(SourceTestResult & { at: string }) | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startSave(async () => {
      const outcome = await updateKnowledgeSourceAction(null, formData);
      setSaveState(outcome);
      if (!outcome?.success) return;

      // The key and grant are never shown back, and the clear boxes are
      // one-shot: leave the form as it would load fresh.
      for (const name of ['apiKey', 'grant']) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = '';
      }
      for (const name of ['clearApiKey', 'clearGrant']) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.checked = false;
      }
      setDirty(false);
      setResult(null);
    });
  }

  function runTest() {
    setSaveState(null);
    startTest(async () => {
      const outcome = await testKnowledgeSourceAction(source.id);
      setResult({ ...outcome, at: new Date().toISOString() });
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <form
          onSubmit={onSubmit}
          onChange={() => {
            setDirty(true);
            setSaveState(null);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={source.id} />

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{source.label}</p>
              <p className="truncate text-xs text-slate-400">
                key: <code className="font-mono">{source.key}</code>
              </p>
            </div>
            <Badge tone={source.isActive ? 'green' : 'slate'}>{source.isActive ? 'active' : 'inactive'}</Badge>
          </div>

          {/* Two fieldsets, because these are two unrelated jobs: reaching the
              API, and reading what it sends back. */}
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Connection
            </legend>
            <div className="min-w-0">
              <Label htmlFor={`baseUrl-${source.id}`}>Base URL</Label>
              <Input id={`baseUrl-${source.id}`} name="baseUrl" defaultValue={source.baseUrl} className="text-xs" />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`path-${source.id}`}>Path</Label>
              <Input id={`path-${source.id}`} name="path" defaultValue={source.path} className="text-xs" />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`label-${source.id}`}>Label</Label>
              <Input id={`label-${source.id}`} name="label" defaultValue={source.label} className="text-xs" />
              <Hint>Also the test search.</Hint>
            </div>
            <div className="min-w-0">
              <Label htmlFor={`apiKey-${source.id}`}>API key</Label>
              <Input
                id={`apiKey-${source.id}`}
                name="apiKey"
                type="password"
                autoComplete="new-password"
                placeholder={source.hasApiKey ? '•••••••• saved — leave blank to keep' : 'not set'}
                className="text-xs"
              />
              {source.hasApiKey ? (
                <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                  <Checkbox name="clearApiKey" /> Clear API key
                </label>
              ) : null}
            </div>
            <div className="min-w-0">
              <Label htmlFor={`grant-${source.id}`}>Grant (optional)</Label>
              <Input
                id={`grant-${source.id}`}
                name="grant"
                autoComplete="off"
                placeholder={source.hasGrant ? '•••••••• saved — leave blank to keep' : 'not set'}
                className="text-xs"
              />
              {source.hasGrant ? (
                <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                  <Checkbox name="clearGrant" /> Clear grant
                </label>
              ) : null}
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-500">
              <Checkbox name="isActive" value="true" defaultChecked={source.isActive} />
              Active (selectable on personas)
            </label>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <legend className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Response mapping
            </legend>
            {(
              [
                ['resultsPath', 'Results path', source.resultsPath],
                ['titlePath', 'Title path', source.titlePath],
                ['textPath', 'Text path', source.textPath],
                ['citationPath', 'Citation path', source.citationPath],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name} className="min-w-0">
                <Label htmlFor={`${name}-${source.id}`}>{label}</Label>
                <Input id={`${name}-${source.id}`} name={name} defaultValue={value} className="font-mono text-xs" />
              </div>
            ))}
          </fieldset>
          <Hint>
            Dot-paths into each hit in the response, e.g. a hit shaped{' '}
            <code className="font-mono">{'{ chunk: { text, title } }'}</code> needs text path{' '}
            <code className="font-mono">chunk.text</code>.
          </Hint>

          <FormMessage state={saveState} />

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
              Save
            </Button>
            {/* Hidden while editing: a test of the saved settings next to
                half-typed new ones answers the wrong question. */}
            {!dirty ? (
              <Button type="button" size="sm" variant="secondary" loading={testing} onClick={runTest}>
                {testing ? null : <Stethoscope />}
                Test
              </Button>
            ) : (
              <span className="text-xs text-slate-400">Save your change to test it.</span>
            )}
          </div>
        </form>

        {result ? (
          <TestStatus state={result.state} message={result.message} at={result.at}>
            {result.titles.length > 0 ? (
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                {result.titles.map((title, index) => (
                  <li key={`${index}-${title}`} className="break-words">
                    {title}
                  </li>
                ))}
              </ol>
            ) : null}
          </TestStatus>
        ) : null}

        <form action={deleteKnowledgeSourceAction} className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <input type="hidden" name="id" value={source.id} />
          <button type="submit" className="text-xs font-medium text-rose-500 hover:underline">
            Delete
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
