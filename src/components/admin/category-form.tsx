'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { saveCategoryAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import type { Category } from '@/db/schema';
import { Card } from '@/components/ui/card';
import { Input, Textarea, Select, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';

const RISK_LEVELS = ['R0', 'R1', 'R2', 'R3'] as const;
const NARRATIVE_FIT_LEVELS = ['low', 'medium', 'high', 'very_high'] as const;

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save category'}
    </button>
  );
}

export function CategoryForm({ category }: { category?: Category }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCategoryAction, null);

  return (
    <form action={formAction}>
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          {category ? `Edit ${category.name}` : 'New category'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/categories"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <SaveButton />
        </div>
      </div>

      <div className="space-y-6">
        <FormMessage state={state} />

        <Card className="space-y-5 p-6">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={category?.name ?? ''} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={category?.description ?? ''} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="color">Colour</Label>
              <input
                id="color"
                type="color"
                name="color"
                defaultValue={category?.color ?? '#6366f1'}
                className="h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="position">Position</Label>
              <Input id="position" name="position" type="number" defaultValue={category?.position ?? 0} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked={category?.isActive ?? true} />
            Active
          </label>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h3 className="font-semibold">UK market context</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Shown wherever this category's audience fit / market data is surfaced.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="ukMarketSize">UK market size</Label>
              <Input id="ukMarketSize" name="ukMarketSize" placeholder="£132 billion" defaultValue={category?.ukMarketSize ?? ''} />
            </div>
            <div>
              <Label htmlFor="ukGrowthRate">UK growth rate</Label>
              <Input id="ukGrowthRate" name="ukGrowthRate" placeholder="6.4% annually" defaultValue={category?.ukGrowthRate ?? ''} />
            </div>
          </div>
          <div>
            <Label htmlFor="ukKeyRegulations">Key regulations</Label>
            <Textarea
              id="ukKeyRegulations"
              name="ukKeyRegulations"
              rows={2}
              defaultValue={(category?.ukKeyRegulations ?? []).join(', ')}
            />
            <Hint>Comma-separated, e.g. FCA_Regulations, GDPR, Companies_Act_2006</Hint>
          </div>
          <div>
            <Label htmlFor="ukIndustryBodies">Industry bodies</Label>
            <Textarea
              id="ukIndustryBodies"
              name="ukIndustryBodies"
              rows={2}
              defaultValue={(category?.ukIndustryBodies ?? []).join(', ')}
            />
            <Hint>Comma-separated, e.g. ICAEW, ACCA, CFA_UK</Hint>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="defaultRiskLevel">Default risk level</Label>
              <Select id="defaultRiskLevel" name="defaultRiskLevel" defaultValue={category?.defaultRiskLevel ?? ''}>
                <option value="">Not set</option>
                {RISK_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="narrativePotential">Narrative potential</Label>
              <Select id="narrativePotential" name="narrativePotential" defaultValue={category?.narrativePotential ?? ''}>
                <option value="">Not set</option>
                {NARRATIVE_FIT_LEVELS.map((level) => (
                  <option key={level} value={level} className="capitalize">{level}</option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
