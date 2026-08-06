import type { Metadata } from 'next';
import Link from 'next/link';
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, personaVersions } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import {
  deletePersonaAction, duplicatePersonaAction, togglePersonaAction,
} from '@/server/actions/admin';
import { getProviderRegistry, resolveProviderId } from '@/lib/ai/registry';
import { formatCredits, initialsOf } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Personas' };

export default async function AdminPersonasPage() {
  const [rows, registry] = await Promise.all([
    db
      .select({
        persona: personas,
        modelTier: personaVersions.modelTier,
        model: personaVersions.model,
        aiProvider: personaVersions.aiProvider,
      })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .orderBy(asc(personas.position), asc(personas.name)),
    getProviderRegistry(),
  ]);


  return (
    <div>
      <PageHeader
        title="Personas"
        description="Every AI specialist available on the platform."
        actions={
          <Link
            href="/admin/personas/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> New persona
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Persona</TH>
              <TH>Model</TH>
              <TH className="text-right">Messages</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>No personas yet.</EmptyRow>
            ) : (
              rows.map(({ persona, modelTier, model, aiProvider }) => (
                <TR key={persona.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        className="grid size-9 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{ background: persona.accentColor }}
                      >
                        {initialsOf(persona.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{persona.name}</p>
                        <p className="truncate text-xs text-slate-400">{persona.expertise}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="font-mono text-xs text-slate-500">
                    {modelTier ? (
                      <Badge tone="brand" className="capitalize">{modelTier}</Badge>
                    ) : (
                      model ?? registry[resolveProviderId(aiProvider)].defaultModel
                    )}
                  </TD>
                  <TD className="text-right">{formatCredits(persona.messagesCount)}</TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <form action={togglePersonaAction}>
                        <input type="hidden" name="id" value={persona.id} />
                        <input type="hidden" name="field" value="isActive" />
                        <button type="submit">
                          <Badge tone={persona.isActive ? 'green' : 'slate'}>
                            {persona.isActive ? 'Published' : 'Draft'}
                          </Badge>
                        </button>
                      </form>
                      {persona.isFeatured ? <Badge tone="amber">Featured</Badge> : null}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <form action={togglePersonaAction}>
                        <input type="hidden" name="id" value={persona.id} />
                        <input type="hidden" name="field" value="isFeatured" />
                        <button
                          type="submit"
                          className="grid size-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Toggle featured"
                        >
                          <Star className={persona.isFeatured ? 'size-4 text-amber-500' : 'size-4'} />
                        </button>
                      </form>

                      <form action={duplicatePersonaAction}>
                        <input type="hidden" name="id" value={persona.id} />
                        <button
                          type="submit"
                          className="grid size-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Duplicate"
                        >
                          <Copy className="size-4" />
                        </button>
                      </form>

                      <Link
                        href={`/admin/personas/${persona.id}`}
                        className="grid size-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Link>

                      <form action={deletePersonaAction}>
                        <input type="hidden" name="id" value={persona.id} />
                        <button
                          type="submit"
                          className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
