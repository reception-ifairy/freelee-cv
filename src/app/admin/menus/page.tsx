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
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>No items in this location.</EmptyRow>
              ) : (
                rows.map((item) => (
                  <TR key={item.id}>
                    <TD className="font-medium">
                      {item.label}
                      {!item.isActive ? <Badge className="ml-1">off</Badge> : null}
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
