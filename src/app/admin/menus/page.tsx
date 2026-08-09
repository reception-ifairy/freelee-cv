import type { Metadata } from 'next';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Label, Select, Checkbox } from '@/components/ui/field';
import { deleteMenuItemAction, saveMenuItemAction } from '@/server/actions/admin';
import { BLOCK_ICON_KEYS } from '@/lib/blocks/catalog';
import { HelpTip } from '@/components/ui/help-tip';
import { BlockIcon } from '@/components/ui/block-icon';
import { CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Menus' };

const LOCATIONS = ['header', 'footer', 'legal'] as const;
type Location = (typeof LOCATIONS)[number];

export default async function AdminMenusPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;
  const active: Location = LOCATIONS.includes(location as Location)
    ? (location as Location)
    : 'header';

  const rows = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.location, active))
    .orderBy(asc(menuItems.position));

  const topLevel = rows.filter((row) => row.parentId === null);
  // Children are listed directly under their parent so the shape of the menu is
  // visible at a glance, rather than having to be reconstructed from ids.
  const ordered = topLevel.flatMap((parent) => [
    { row: parent, depth: 0 },
    ...rows.filter((row) => row.parentId === parent.id).map((row) => ({ row, depth: 1 })),
  ]);
  const orphans = rows.filter((row) => row.parentId !== null && !topLevel.some((p) => p.id === row.parentId));

  return (
    <div>
      <PageHeader title="Menus" description="Navigation shown in the header and footer." />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {LOCATIONS.map((item) => (
          <Link
            key={item}
            href={`/admin/menus?location=${item}`}
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
        <InlineForm action={saveMenuItemAction} title="New item">
          <input type="hidden" name="location" value={active} />
          <div>
            <Label htmlFor="label">Label *</Label>
            <Input id="label" name="label" required />
          </div>
          <div>
            <Label htmlFor="href">Link *</Label>
            <Input id="href" name="href" required placeholder="/pricing" />
          </div>
          <div>
            <Label htmlFor="visibleTo">Visible to</Label>
            <Select id="visibleTo" name="visibleTo" defaultValue="all">
              <option value="all">Everyone</option>
              <option value="guest">Signed-out visitors</option>
              <option value="auth">Signed-in users</option>
              <option value="admin">Admins only</option>
            </Select>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Label htmlFor="parentId" className="mb-0">Sits under</Label>
              <HelpTip
                title="Sits under"
                body="Leave as 'Top level' for a normal link. Pick a parent and this becomes an item in that parent's dropdown. Menus nest one level only — a dropdown inside a dropdown is a maze, not navigation."
              />
            </div>
            <Select id="parentId" name="parentId" defaultValue="">
              <option value="">Top level</option>
              {topLevel.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="icon">Icon</Label>
            <Select id="icon" name="icon" defaultValue="">
              <option value="">None</option>
              {BLOCK_ICON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Label htmlFor="description" className="mb-0">Description</Label>
              <HelpTip title="Description" body="A short line shown under the label inside a dropdown. Ignored for top-level links." />
            </div>
            <Input id="description" name="description" maxLength={160} />
          </div>
          <div>
            <Label htmlFor="position">Position</Label>
            <Input id="position" name="position" type="number" defaultValue={0} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked /> Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="openInNewTab" /> Open in new tab
          </label>
        </InlineForm>

        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <tr>
                <TH>Label</TH>
                <TH>Link</TH>
                <TH>Visibility</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {ordered.length === 0 ? (
                <EmptyRow colSpan={4}>No items in this location.</EmptyRow>
              ) : (
                [...ordered, ...orphans.map((row) => ({ row, depth: 1 }))].map(({ row: item, depth }) => (
                  <TR key={item.id}>
                    <TD className="font-medium">
                      <span className={cn('flex items-center gap-1.5', depth === 1 && 'pl-5')}>
                        {depth === 1 ? <CornerDownRight className="size-3.5 shrink-0 text-slate-300 dark:text-slate-600" /> : null}
                        {item.icon ? <BlockIcon name={item.icon} className="size-3.5 text-slate-400" /> : null}
                        {item.label}
                        {!item.isActive ? <Badge className="ml-1">off</Badge> : null}
                      </span>
                      {item.description ? <span className="mt-0.5 block pl-5 text-xs text-slate-400">{item.description}</span> : null}
                    </TD>
                    <TD>
                      <code className="text-xs text-slate-400">{item.href}</code>
                    </TD>
                    <TD>
                      <Badge>{item.visibleTo}</Badge>
                    </TD>
                    <TD className="text-right">
                      <form action={deleteMenuItemAction}>
                        <input type="hidden" name="id" value={item.id} />
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
