import type { Metadata } from 'next';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { promptModifiers } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Disclosure } from '@/components/ui/disclosure';
import { ModifiersList } from './modifiers-list';
import { Input, Textarea, Label, Checkbox, Hint } from '@/components/ui/field';
import { saveModifierAction } from '@/server/actions/admin';

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

  const [rows, perType] = await Promise.all([
    db.select().from(promptModifiers).where(eq(promptModifiers.type, active)).orderBy(asc(promptModifiers.position)),
    db.select({ type: promptModifiers.type, count: sql<number>`count(*)::int` }).from(promptModifiers).groupBy(promptModifiers.type),
  ]);
  const count = new Map(perType.map((r) => [r.type, r.count]));
  // The rail is the five types, as the taxonomy browser's tree is its categories (#90).
  const rail = TYPES.map((item) => ({ label: item, href: `/admin/modifiers?type=${item}`, count: count.get(item) ?? 0, active: item === active }));

  return (
    <div>
      <PageHeader
        title="Prompt modifiers"
        description="Reusable instructions users can layer onto any conversation — tone, writing style, output format."
      />

      <ModifiersList
        rows={rows}
        kind={active}
        rail={rail}
        form={
          <div className="rounded-card border hairline px-2">
            <Disclosure title={`New ${active} modifier`}>
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
            </Disclosure>
          </div>
        }
      />
    </div>
  );
}
