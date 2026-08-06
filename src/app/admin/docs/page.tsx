import type { Metadata } from 'next';
import Link from 'next/link';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Markdown } from '@/components/site/markdown';
import { cn } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Documentation' };

const DOCS_DIR = path.join(process.cwd(), 'docs');

type DocEntry = { file: string; title: string };

async function listDocs(): Promise<DocEntry[]> {
  let files: string[];
  try {
    files = (await fs.readdir(DOCS_DIR)).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }

  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8');
      const heading = content.match(/^#\s+(.+)$/m);
      return { file, title: heading?.[1]?.trim() ?? file };
    }),
  );
  return entries;
}

export default async function AdminDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const { doc } = await searchParams;
  const docs = await listDocs();

  if (docs.length === 0) {
    return (
      <div>
        <PageHeader title="Documentation" description="Implementation & deployment reference." />
        <Card className="p-6 text-sm text-slate-500 dark:text-slate-400">
          No docs found in <code className="font-mono">docs/</code>.
        </Card>
      </div>
    );
  }

  const active = docs.find((d) => d.file === doc) ?? docs[0];
  if (doc && !docs.some((d) => d.file === doc)) notFound();

  const content = await fs.readFile(path.join(DOCS_DIR, active.file), 'utf-8');

  return (
    <div>
      <PageHeader title="Documentation" description="Implementation & deployment reference — kept current as the app changes." />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="h-fit space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          {docs.map((d) => (
            <Link
              key={d.file}
              href={`/admin/docs?doc=${d.file}`}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition',
                d.file === active.file
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {d.title}
            </Link>
          ))}
        </nav>

        <Card className="min-w-0 p-6 sm:p-8">
          <Markdown>{content}</Markdown>
        </Card>
      </div>
    </div>
  );
}
