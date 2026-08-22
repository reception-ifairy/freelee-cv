import type { Metadata } from 'next';
import { BookOpen, Layers, Quote, Coins } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { listDocuments, libraryTotals } from '@/lib/library/queries';
import { activeEmbeddingModel } from '@/lib/library/embed';
import { LIBRARY_ROOT } from '@/lib/library/paths';
import { embedCost } from './status';
import { Shelf } from './shelf';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Knowledgebase' };

export default async function KnowledgebasePage() {
  const [documents, totals, model] = await Promise.all([
    listDocuments(),
    libraryTotals(),
    activeEmbeddingModel(),
  ]);

  return (
    <div>
      <PageHeader
        title="Knowledgebase"
        description="The library your bots read from. Drop books into the folder, choose what to process, and see exactly what each one taught them."
      />

      {!model ? (
        <Card padding="md" className="mb-6 border-amber-300 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="text-sm">
            <strong>No embedding model is set up yet.</strong> Documents can be found and read, but not
            made searchable until one is chosen under <em>Settings → AI models</em>.
          </p>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Documents" value={String(totals.documents)} icon={BookOpen}
          hint={`${totals.ready} ready · ${totals.pending} waiting${totals.failed ? ` · ${totals.failed} need attention` : ''}`} />
        <StatTile label="Passages" value={totals.passages.toLocaleString()} icon={Quote}
          hint="The searchable pieces a bot can quote" />
        <StatTile label="Shelves" value={String(new Set(documents.flatMap((d) => d.collections.split(', ').filter(Boolean))).size)}
          icon={Layers} hint="A folder becomes a shelf" />
        <StatTile label="Spent indexing" value={embedCost(Number(totals.tokens))} icon={Coins}
          hint={`${Number(totals.tokens).toLocaleString()} tokens, once — asking costs more than indexing`} />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nothing in the library yet"
          description={`Copy PDFs into ${LIBRARY_ROOT} — one folder per subject, and each folder becomes a shelf your bots can be granted. Then press Scan folder.`}
        />
      ) : null}

      <Shelf documents={documents} root={LIBRARY_ROOT} />
    </div>
  );
}
