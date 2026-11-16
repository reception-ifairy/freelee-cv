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
import { RailItem } from '@/components/admin/rail-item';
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
  // The folder picked in the rail (freelee #92); null is every folder.
  const [folder, setFolder] = useState<string | null>(null);
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

  const inFilter = (doc: DocumentRow, key: FilterKey) =>
    key === 'all' || (key === 'attention' ? ATTENTION.has(doc.status) : doc.status === key);
  const folderOf = (doc: DocumentRow) => (doc.sourcePath.includes('/') ? doc.sourcePath.split('/')[0] : 'Loose files');

  const statusMatches = useMemo(() => documents.filter((doc) => inFilter(doc, filter)), [documents, filter]);
  const visible = useMemo(() => statusMatches.filter((doc) => folder === null || folderOf(doc) === folder), [statusMatches, folder]);

  // The rail's counts: each status over every document; each folder within the status picked.
  const statusCount = (key: FilterKey) => documents.filter((doc) => inFilter(doc, key)).length;
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) counts.set(folderOf(doc), 0);
    for (const doc of statusMatches) counts.set(folderOf(doc), (counts.get(folderOf(doc)) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [documents, statusMatches]);

  const byFolder = useMemo(() => {
    const groups = new Map<string, DocumentRow[]>();
    for (const doc of visible) {
      const list = groups.get(folderOf(doc)) ?? [];
      list.push(doc);
      groups.set(folderOf(doc), list);
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
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
      {/* The taxonomy's layout (freelee #92): what to show on the left, the books on the right. */}
      <nav aria-label="Library" className="mb-4 lg:mb-0">
        <div className="flex flex-wrap gap-1 lg:sticky lg:top-20 lg:flex-col lg:flex-nowrap">
          <p className="eyebrow mb-1 hidden px-2 lg:block">Status</p>
          {FILTERS.map((f) => (
            <RailItem key={f.key} label={f.label} count={statusCount(f.key)} active={filter === f.key} strong={f.key === 'all'} onClick={() => setFilter(f.key)} />
          ))}
          {folders.length > 1 ? (
            <>
              <p className="eyebrow mt-3 mb-1 hidden px-2 lg:block">Folders</p>
              <RailItem label="Every folder" count={statusMatches.length} active={folder === null} strong onClick={() => setFolder(null)} />
              {folders.map(([name, count]) => (
                <RailItem key={name} label={name} count={count} active={folder === name} onClick={() => setFolder(name)} />
              ))}
            </>
          ) : null}
        </div>
      </nav>

      <div className="min-w-0">
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

        <Link
          href="/admin/knowledgebase/collections"
          className="focus-ring rounded-control px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Shelves →
        </Link>

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
    </div>
  );
}
