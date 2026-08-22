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
export const metadata: Metadata = { title: 'Prototypes' };

/**
 * Everything designed in a workbench and not yet live.
 *
 * "Prototype" here means a persona that is `isActive: false` — off the shelf,
 * unlisted, unsellable — usually with a real `draft` version behind it. The list
 * exists so work in progress is visible without opening twenty categories to
 * find it.
 */
export default async function PrototypesPage() {
  const rows = await listPrototypes();

  return (
    <div>
      <PageHeader
        title="Prototypes"
        description="Specialists designed in a workbench and not yet live. Nothing here is on the shelf, listed, or chargeable until you publish it."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No prototypes yet"
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
