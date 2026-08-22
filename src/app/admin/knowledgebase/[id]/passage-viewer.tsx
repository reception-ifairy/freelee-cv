'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Quote } from 'lucide-react';

/**
 * The passages themselves.
 *
 * This is the screen that turns embedding from something you trust into
 * something you can judge. If passage 41 reads as a coherent paragraph and
 * passage 42 is half a table, that is visible here in five seconds and
 * invisible everywhere else. Everything upstream — the column detection, the
 * de-hyphenation, the running-head stripping — is only as good as what shows
 * up on this list.
 */
export function PassageViewer({
  passages, offset, pageSize, total, documentId,
}: {
  documentId: string;
  passages: {
    id: number; position: number; pageFrom: number | null; pageTo: number | null;
    heading: string | null; kind: string; text: string; charCount: number; embedded: boolean;
  }[];
  offset: number;
  pageSize: number;
  total: number;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (total === 0) {
    return (
      <EmptyState
        icon={Quote}
        title="No passages yet"
        description="Once this document is processed, every passage a bot could quote will be listed here — so you can read what it will actually see."
      />
    );
  }

  const from = offset + 1;
  const to = Math.min(offset + pageSize, total);
  const currentPage = Math.floor(offset / pageSize) + 1;
  const lastPage = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">What the bot will read</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {from}–{to} of {total}
        </p>
      </div>

      <div className="grid gap-2">
        {passages.map((p) => {
          const expanded = open === p.id;
          const pages = p.pageFrom
            ? p.pageTo && p.pageTo !== p.pageFrom ? `pp. ${p.pageFrom}–${p.pageTo}` : `p. ${p.pageFrom}`
            : null;
          return (
            <Card key={p.id} padding="sm">
              <button
                type="button"
                className="flex w-full items-baseline gap-3 text-left"
                onClick={() => setOpen(expanded ? null : p.id)}
                aria-expanded={expanded}
              >
                <span className="font-mono text-xs tabular-nums text-slate-400">#{p.position + 1}</span>
                <span className="min-w-0 flex-1">
                  {p.heading ? (
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{p.heading}</span>
                  ) : null}
                  <span className={expanded ? 'text-sm' : 'line-clamp-2 text-sm'}>{p.text}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {pages ? <span className="text-xs text-slate-400">{pages}</span> : null}
                  {p.kind !== 'body' ? (
                    <Badge tone="slate" title="Kept, but not searched by default — reference lists crowd out real answers.">
                      {p.kind === 'backmatter' ? 'references' : 'front matter'}
                    </Badge>
                  ) : null}
                  {!p.embedded ? <Badge tone="amber">not searchable</Badge> : null}
                </span>
              </button>
            </Card>
          );
        })}
      </div>

      {lastPage > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          {currentPage > 1 ? (
            <Link className="focus-ring rounded-control px-2 py-1 hover:underline"
              href={`/admin/knowledgebase/${documentId}?page=${currentPage - 1}`}>← Previous</Link>
          ) : <span />}
          <span className="text-xs text-slate-400">page {currentPage} of {lastPage}</span>
          {currentPage < lastPage ? (
            <Link className="focus-ring rounded-control px-2 py-1 hover:underline"
              href={`/admin/knowledgebase/${documentId}?page=${currentPage + 1}`}>Next →</Link>
          ) : <span />}
        </div>
      ) : null}
    </div>
  );
}
