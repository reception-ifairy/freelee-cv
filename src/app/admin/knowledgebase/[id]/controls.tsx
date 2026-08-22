'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Hint } from '@/components/ui/field';
import {
  processDocumentsAction,
  removeDocumentAction,
  setDocumentCollectionsAction,
} from '@/server/actions/admin-knowledgebase';

/**
 * Process, shelve, remove.
 *
 * Removal is two buttons rather than one with a checkbox, because the two are
 * genuinely different acts and the difference is easy to miss at the moment
 * you are clicking: forgetting what a book taught the bots is reversible in
 * minutes, deleting the book itself is not. Each says exactly what it will do.
 */
export function DocumentControls({
  documentId, title, status, collections, selected,
}: {
  documentId: string;
  title: string;
  status: string;
  collections: { id: number; label: string }[];
  selected: number[];
}) {
  const router = useRouter();
  const [shelves, setShelves] = useState<Set<number>>(new Set(selected));
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'passages' | 'file' | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ success?: string; error?: string } | null | undefined>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage(result?.success ?? result?.error ?? null);
      router.refresh();
    });

  return (
    <>
      <Card padding="md">
        <p className="eyebrow mb-3">Shelves</p>
        {collections.length === 0 ? (
          <Hint>No shelves yet. A folder inside the library becomes one automatically.</Hint>
        ) : (
          <div className="grid gap-2">
            {collections.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={shelves.has(c.id)}
                  onChange={() =>
                    setShelves((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                      return next;
                    })
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        )}
        <Hint className="mt-2">A bot granted a shelf can read every document on it.</Hint>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          loading={pending}
          onClick={() => run(() => setDocumentCollectionsAction(documentId, [...shelves]))}
        >
          Save shelves
        </Button>
      </Card>

      <Card padding="md">
        <p className="eyebrow mb-3">Actions</p>

        <Button
          className="w-full"
          loading={pending}
          disabled={status === 'processing'}
          onClick={() => run(() => processDocumentsAction([documentId]))}
        >
          <Play className="size-4" />
          {status === 'ready' ? 'Process again' : 'Process now'}
        </Button>
        <Hint className="mt-1.5">
          {status === 'ready'
            ? 'Re-reads the file and replaces its passages. The old ones stay in place until the new ones are ready.'
            : 'Reads the file, splits it and makes it searchable. Costs a fraction of a penny.'}
        </Hint>

        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          {confirming === null ? (
            <div className="grid gap-2">
              <Button variant="ghost" onClick={() => setConfirming('passages')}>
                Forget this document
              </Button>
              <Button variant="ghost" onClick={() => setConfirming('file')}>
                <Trash2 className="size-4" /> Delete the file too
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm">
                {confirming === 'file'
                  ? `Delete “${title}” and its file from the folder? The file cannot be recovered from here.`
                  : `Remove “${title}” from the knowledgebase? The file stays in the folder, so a scan would find it again.`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  loading={pending}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set('id', documentId);
                    formData.set('scope', confirming);
                    run(async () => {
                      const result = await removeDocumentAction(formData);
                      if (result?.success) router.push('/admin/knowledgebase');
                      return result;
                    });
                  }}
                >
                  Yes, {confirming === 'file' ? 'delete it' : 'forget it'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {message ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{message}</p> : null}
      </Card>
    </>
  );
}
