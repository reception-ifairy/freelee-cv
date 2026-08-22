import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDocument, listPassages, collectionsForDocument, listCollections } from '@/lib/library/queries';
import { statusCopy, humanBytes, embedCost } from '../status';
import { Pipeline } from './pipeline';
import { PassageViewer } from './passage-viewer';
import { TestQuestion } from './test-question';
import { DocumentControls } from './controls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Document' };

const PAGE_SIZE = 25;

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page } = await searchParams;
  const offset = Math.max(0, (Number(page ?? 1) - 1) * PAGE_SIZE);

  const doc = await getDocument(id);
  if (!doc) notFound();

  const [passages, own, all] = await Promise.all([
    listPassages(id, offset, PAGE_SIZE),
    collectionsForDocument(id),
    listCollections(),
  ]);

  const copy = statusCopy(doc.status);

  return (
    <div>
      <Link
        href="/admin/knowledgebase"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> Knowledgebase
      </Link>

      <PageHeader
        title={doc.title}
        description={[doc.author, doc.year ? String(doc.year) : null, doc.filename].filter(Boolean).join(' · ')}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={copy.tone}>{copy.label}</Badge>
        <p className="text-sm text-slate-500 dark:text-slate-400">{copy.hint}</p>
      </div>

      {doc.error ? (
        <Card padding="md" className="mb-6 border-rose-300 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20">
          <p className="eyebrow mb-1">What went wrong</p>
          <p className="text-sm">{doc.error}</p>
        </Card>
      ) : null}

      <Pipeline
        status={doc.status}
        bytes={doc.bytes}
        pages={doc.pages}
        textChars={doc.textChars}
        passageCount={doc.passageCount}
        embeddingModel={doc.embeddingModel}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TestQuestion collectionKeys={own.map((c) => c.key)} title={doc.title} />
          <div className="mt-6">
            <PassageViewer
              documentId={id}
              passages={passages}
              offset={offset}
              pageSize={PAGE_SIZE}
              total={doc.passageCount}
            />
          </div>
        </div>

        <div className="grid content-start gap-4">
          <Card padding="md">
            <p className="eyebrow mb-3">Facts</p>
            <dl className="grid gap-2 text-sm">
              <Fact label="File" value={doc.sourcePath} mono />
              <Fact label="Size" value={humanBytes(doc.bytes)} />
              <Fact label="Pages" value={doc.pages ? String(doc.pages) : '—'} />
              <Fact label="Passages" value={doc.passageCount ? String(doc.passageCount) : '—'} />
              <Fact label="Embedded with" value={doc.embeddingModel ?? '—'} mono />
              <Fact
                label="Cost to index"
                value={embedCost(Number(doc.ingestTokens))}
                hint={doc.ingestTokens ? `${Number(doc.ingestTokens).toLocaleString()} tokens, once` : undefined}
              />
              <Fact label="Last processed" value={doc.indexedAt ? doc.indexedAt.toLocaleString('en-GB') : 'never'} />
            </dl>
          </Card>

          <DocumentControls
            documentId={id}
            title={doc.title}
            status={doc.status}
            collections={all.map((c) => ({ id: c.id, label: c.label }))}
            selected={own.map((c) => c.id)}
          />
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`min-w-0 truncate text-right ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
        {hint ? <span className="block text-xs font-normal text-slate-400">{hint}</span> : null}
      </dd>
    </div>
  );
}
