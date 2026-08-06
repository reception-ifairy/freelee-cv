import type { Metadata } from 'next';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { promptModifiers } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Textarea, Label, Checkbox, Hint } from '@/components/ui/field';
import { deleteModifierAction, saveModifierAction } from '@/server/actions/admin';
import { cn } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Prompt modifiers' };

const TYPES = ['tone', 'writing', 'output', 'length', 'audience'] as const;
type ModifierType = (typeof TYPES)[number];

export default async function AdminModifiersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const active: ModifierType = TYPES.includes(type as ModifierType) ? (type as ModifierType) : 'tone';

  const rows = await db
    .select()
    .from(promptModifiers)
    .where(eq(promptModifiers.type, active))
    .orderBy(asc(promptModifiers.position));

  return (
    <div>
      <PageHeader
        title="Prompt modifiers"
        description="Reusable instructions users can layer onto any conversation — tone, writing style, output format."
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {TYPES.map((item) => (
          <Link
            key={item}
            href={`/admin/modifiers?type=${item}`}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium capitalize transition',
              item === active
                ? 'bg-white shadow-sm dark:bg-slate-900'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            {item}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={saveModifierAction} title={`New ${active} modifier`}>
          <input type="hidden" name="type" value={active} />
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="Friendly" />
          </div>
          <div>
            <Label htmlFor="value">Instruction *</Label>
            <Textarea
              id="value"
              name="value"
              rows={4}
              required
              placeholder="Write in a warm, conversational tone. Use contractions and short sentences."
            />
            <Hint>Appended to the system prompt when the user selects this option.</Hint>
          </div>
          <div>
            <Label htmlFor="position">Position</Label>
            <Input id="position" name="position" type="number" defaultValue={0} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked /> Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isDefault" /> Default for this type
          </label>
        </InlineForm>

        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Instruction</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={3}>No {active} modifiers yet.</EmptyRow>
              ) : (
                rows.map((modifier) => (
                  <TR key={modifier.id}>
                    <TD>
                      <span className="font-medium">{modifier.name}</span>
                      {modifier.isDefault ? <Badge tone="brand" className="ml-1">default</Badge> : null}
                      {!modifier.isActive ? <Badge className="ml-1">off</Badge> : null}
                    </TD>
                    <TD className="text-slate-500">
                      <span className="line-clamp-2">{modifier.value}</span>
                    </TD>
                    <TD className="text-right">
                      <form action={deleteModifierAction}>
                        <input type="hidden" name="id" value={modifier.id} />
                        <button
                          type="submit"
                          className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
