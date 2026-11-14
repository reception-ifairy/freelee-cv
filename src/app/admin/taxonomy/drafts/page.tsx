import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PersonaMark } from '@/components/site/persona-mark';
import { listPrototypes } from '@/lib/taxonomy/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Drafts' };

/**
 * Every persona that is not live: switched off, or drafted in a workbench and
 * not yet published.
 *
 * Named "Prototypes" until 2026-11-14, which promised workbench work; in
 * practice it lists every `isActive: false` persona — mostly older ones
 * switched off — so "Drafts" says what it is. The old URL redirects here.
 */
export default async function DraftsPage() {
  const rows = await listPrototypes();

  return (
    <div>
      <PageHeader
        title="Drafts"
        description="Personas that are not live: switched off, or designed in a workbench and not yet published. Nothing here is on the shelf, listed or chargeable until you publish it."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No drafts"
          description="Open a category, talk the design through with the architect, and save it here as a draft."
          action={{ label: 'Browse categories', href: '/admin/taxonomy' }}
        />
      ) : null}

      <div className="grid gap-2">
        {rows.map((row) => (
          <Card key={row.id} padding="sm" className="flex items-center gap-3">
            <PersonaMark
              personaKey={row.slug}
              categoryKey={row.categoryName ?? 'unfiled'}
              categoryIndex={row.categoryId ?? 0}
              accent={row.accentColor ?? '#6366f1'}
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <Link href={`/admin/personas/${row.id}`} className="font-medium hover:underline">
                {row.name}
              </Link>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[row.expertise, row.sectorName ?? row.categoryName].filter(Boolean).join(' · ') ||
                  'unfiled'}
              </p>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              {row.createdAt.toLocaleDateString('en-GB')}
            </p>
            <Badge tone={row.hasDraft ? 'amber' : 'slate'}>
              {row.hasDraft ? 'draft in progress' : 'not published'}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
