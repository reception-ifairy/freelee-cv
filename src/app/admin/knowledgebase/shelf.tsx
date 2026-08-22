'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderSync, Play, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/field';
import { scanLibraryAction, processDocumentsAction } from '@/server/actions/admin-knowledgebase';
import type { DocumentRow } from '@/lib/library/queries';
import { statusCopy, humanBytes } from './status';

/**
 * The shelf.
 *
 * Two ideas the layout has to carry. First, **nothing is processed by simply
 * existing** — a scan puts a book here saying "not processed yet" and it stays
 * that way until somebody presses a button, because processing spends money
 * and sends text to an external API. Second, every state is written in
 * language a person can act on; the status enum is never rendered.
 */

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'pending', label: 'Not processed' },
  { key: 'ready', label: 'Ready' },
  { key: 'attention', label: 'Needs attention' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const ATTENTION = new Set(['failed', 'needs_ocr', 'missing']);

export function Shelf({ documents, root }: { documents: DocumentRow[]; root: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const working = documents.some((d) => d.status === 'processing' || d.status === 'pending');

  /*
   * Poll while anything is in flight, and stop the moment nothing is — the
   * same approach the crew-run screen takes, and for the same reason: the SSE
   * endpoint authorises by conversation participation, and an admin watching
   * an ingest is not a participant in anything. Widening that to admins would
   * mean widening who can tap any conversation feed.
   */
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [working, router]);

  const visible = useMemo(
    () =>
      documents.filter((doc) => {
        if (filter === 'all') return true;
        if (filter === 'attention') return ATTENTION.has(doc.status);
        return doc.status === filter;
      }),
    [documents, filter],
  );

  const byFolder = useMemo(() => {
    const groups = new Map<string, DocumentRow[]>();
    for (const doc of visible) {
      const folder = doc.sourcePath.includes('/') ? doc.sourcePath.split('/')[0] : 'Loose files';
      const list = groups.get(folder) ?? [];
      list.push(doc);
      groups.set(folder, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const processable = visible.filter((d) => d.status !== 'processing' && d.status !== 'missing');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await scanLibraryAction();
              setMessage(result?.success ?? result?.error ?? null);
              router.refresh();
            })
          }
        >
          <FolderSync className="size-4" /> Scan folder
        </Button>

        <Button
          disabled={selected.size === 0}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await processDocumentsAction([...selected]);
              setMessage(result?.success ?? result?.error ?? null);
              setSelected(new Set());
              router.refresh();
            })
          }
        >
          <Play className="size-4" />
          {selected.size > 0 ? `Process ${selected.size} selected` : 'Process selected'}
        </Button>

        <div className="ms-auto flex gap-1 rounded-control bg-slate-100 p-1 dark:bg-slate-800/60">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-control px-3 py-1 text-xs font-medium transition ${
                filter === f.key ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <Card padding="sm" className="mb-4">
          <p className="text-sm">{message}</p>
        </Card>
      ) : null}

      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Files live in <code className="font-mono">{root}</code>. Each folder becomes a shelf a bot can be
        granted. Scanning only lists what is there — nothing is read or sent anywhere until you press Process.
      </p>

      {byFolder.map(([folder, docs]) => (
        <section key={folder} className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="eyebrow">{folder}</h2>
            <span className="text-xs text-slate-400">{docs.length}</span>
            {processable.length > 0 ? (
              <button
                type="button"
                className="text-xs text-slate-500 underline-offset-2 hover:underline"
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    const ids = docs.filter((d) => d.status !== 'processing').map((d) => d.id);
                    const allOn = ids.every((id) => next.has(id));
                    for (const id of ids) if (allOn) next.delete(id); else next.add(id);
                    return next;
                  })
                }
              >
                select all
              </button>
            ) : null}
          </div>

          <div className="grid gap-2">
            {docs.map((doc) => {
              const copy = statusCopy(doc.status);
              return (
                <Card key={doc.id} padding="sm" className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(doc.id)}
                    onChange={() => toggle(doc.id)}
                    disabled={doc.status === 'processing'}
                    aria-label={`Select ${doc.title}`}
                    className="mt-1"
                  />
                  <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/knowledgebase/${doc.id}`} className="font-medium hover:underline">
                      {doc.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{copy.hint}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                      {doc.pages ? <span>{doc.pages} pages</span> : null}
                      {doc.passageCount > 0 ? <span>{doc.passageCount} passages</span> : null}
                      <span>{humanBytes(doc.bytes)}</span>
                      {doc.collections ? <span>on {doc.collections}</span> : <span>on no shelf</span>}
                    </p>
                  </div>
                  <Badge tone={copy.tone}>{copy.label}</Badge>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
