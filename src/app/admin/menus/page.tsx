import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { MenusList, type MenuItemRow } from './menus-list';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Label, Select, Checkbox } from '@/components/ui/field';
import { saveMenuItemAction } from '@/server/actions/admin';
import { BLOCK_ICON_KEYS } from '@/lib/blocks/catalog';
import { HelpTip } from '@/components/ui/help-tip';
import { BlockIcon } from '@/components/ui/block-icon';
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

  const view = await getAdminView('menus');
  const items: MenuItemRow[] = [...ordered, ...orphans.map((row) => ({ row, depth: 1 as const }))].map(({ row, depth }) => ({
    id: row.id,
    label: row.label,
    href: row.href,
    visibleTo: row.visibleTo,
    isActive: row.isActive,
    icon: row.icon,
    description: row.description,
    depth: depth as 0 | 1,
    parentLabel: topLevel.find((p) => p.id === row.parentId)?.label ?? null,
  }));

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

        <div className="lg:col-span-2">
          <MenusList rows={items} view={view} />
        </div>
      </div>
    </div>
  );
}
