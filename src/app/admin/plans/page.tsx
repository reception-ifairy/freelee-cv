import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { InlineForm } from '@/components/admin/inline-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from '@/components/ui/table';
import { Input, Textarea, Select, Label, Checkbox } from '@/components/ui/field';
import { savePlanAction, deletePlanAction } from '@/server/actions/admin-billing';
import { formatMoney } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Subscription plans' };

export default async function AdminPlansPage() {
  const rows = await db.select().from(plans).orderBy(asc(plans.sort), asc(plans.priceCents));

  return (
    <div>
      <PageHeader
        title="Subscription plans"
        description="Recurring billing — any interval. Checkout builds the Stripe recurring price inline, no pre-created Price object needed. See docs/12-billing-overhaul.md."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <InlineForm action={savePlanAction} title="New plan" submitLabel="Create plan">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="Team monthly" />
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
              <Label htmlFor="intervalUnit">Bills every</Label>
              <Select id="intervalUnit" name="intervalUnit" defaultValue="month">
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
                <option value="year">Year(s)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="intervalCount">Count</Label>
              <Input id="intervalCount" name="intervalCount" type="number" min={1} defaultValue={1} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="priceCents">Price (minor units) *</Label>
              <Input id="priceCents" name="priceCents" type="number" min={0} required placeholder="2900" />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="GBP" maxLength={3} />
            </div>
          </div>
          <div>
            <Label htmlFor="creditsPerCycle">Credits granted per cycle</Label>
            <Input id="creditsPerCycle" name="creditsPerCycle" type="number" min={0} defaultValue={0} />
          </div>
          <div>
            <Label htmlFor="tier">Tier (gating order)</Label>
            <Input id="tier" name="tier" type="number" min={0} defaultValue={1} />
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
                <TH>Plan</TH>
                <TH>Price</TH>
                <TH>Credits/cycle</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>No plans yet.</EmptyRow>
              ) : (
                rows.map((plan) => (
                  <TR key={plan.id}>
                    <TD>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-slate-400">
                        {plan.key} · every {plan.intervalCount} {plan.intervalUnit}
                        {plan.intervalCount > 1 ? 's' : ''}
                      </p>
                    </TD>
                    <TD className="font-mono text-xs">{formatMoney(plan.priceCents, plan.currency)}</TD>
                    <TD className="text-xs">{plan.creditsPerCycle.toLocaleString('en-US')}</TD>
                    <TD>
                      <div className="flex gap-1">
                        <Badge tone={plan.isActive ? 'green' : 'slate'}>{plan.isActive ? 'active' : 'off'}</Badge>
                        {plan.isPublic ? <Badge tone="brand">public</Badge> : null}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <form action={deletePlanAction}>
                        <input type="hidden" name="id" value={plan.id} />
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
