import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { passProducts } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Textarea, Select, Label, Checkbox } from '@/components/ui/field';
import { savePassProductAction, deletePassProductAction } from '@/server/actions/admin-billing';
import { formatMoney } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Access passes' };

export default async function AdminPassesPage() {
  const rows = await db.select().from(passProducts).orderBy(asc(passProducts.sort), asc(passProducts.priceCents));

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

        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <tr>
                <TH>Pass</TH>
                <TH>Duration</TH>
                <TH>Price</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>No passes yet.</EmptyRow>
              ) : (
                rows.map((pass) => (
                  <TR key={pass.id}>
                    <TD>
                      <p className="font-medium">{pass.name}</p>
                      <p className="text-xs text-slate-400">{pass.key}</p>
                    </TD>
                    <TD className="text-xs">
                      {pass.durationValue} {pass.durationUnit}
                      {pass.durationValue > 1 ? 's' : ''}
                    </TD>
                    <TD className="font-mono text-xs">{formatMoney(pass.priceCents, pass.currency)}</TD>
                    <TD>
                      <div className="flex gap-1">
                        <Badge tone={pass.isActive ? 'green' : 'slate'}>{pass.isActive ? 'active' : 'off'}</Badge>
                        {pass.isPublic ? <Badge tone="brand">public</Badge> : null}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <form action={deletePassProductAction}>
                        <input type="hidden" name="id" value={pass.id} />
                        <button type="submit" className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
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
