import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { passProducts } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { PassesList, type PassRow } from './passes-list';
import { InlineForm } from '@/components/admin/inline-form';
import { Input, Textarea, Select, Label, Checkbox } from '@/components/ui/field';
import { savePassProductAction, deletePassProductAction } from '@/server/actions/admin-billing';
import { formatMoney } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Access passes' };

export default async function AdminPassesPage() {
  const view = await getAdminView('passes');
  const rows = await db.select().from(passProducts).orderBy(asc(passProducts.sort), asc(passProducts.priceCents));

  const items: PassRow[] = rows.map((pass) => ({
    id: pass.id,
    name: pass.name,
    key: pass.key,
    duration: `${pass.durationValue} ${pass.durationUnit}${pass.durationValue > 1 ? 's' : ''}`,
    price: formatMoney(pass.priceCents, pass.currency),
    isActive: pass.isActive,
    isPublic: pass.isPublic,
  }));

  return (
    <div>
      <PageHeader
        title="Access passes"
        description="Time-boxed unmetered access — 1 hour, 1 day, 1 week. Buying one grants an entitlement, not credits; the chat route skips the credit charge while it's active. See docs/12-billing-overhaul.md."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={savePassProductAction} title="New pass" submitLabel="Create pass">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="24-hour pass" />
          </div>
          <div>
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" placeholder="auto-generated from name" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="durationUnit">Duration unit</Label>
              <Select id="durationUnit" name="durationUnit" defaultValue="day">
                <option value="hour">Hour(s)</option>
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="durationValue">Duration</Label>
              <Input id="durationValue" name="durationValue" type="number" min={1} defaultValue={1} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="priceCents">Price (minor units) *</Label>
              <Input id="priceCents" name="priceCents" type="number" min={0} required placeholder="500" />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="GBP" maxLength={3} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked /> Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isPublic" defaultChecked /> Public (shown on /pricing)
          </label>
        </InlineForm>

        <div className="lg:col-span-2">
          <PassesList rows={items} view={view} />
        </div>
      </div>
    </div>
  );
}
