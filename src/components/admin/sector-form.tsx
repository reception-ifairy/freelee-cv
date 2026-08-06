'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { saveSectorAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import type { Category, Sector } from '@/db/schema';
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
      {pending ? 'Saving…' : 'Save sector'}
    </button>
  );
}

type Props = { sector?: Sector; categories: Category[]; defaultCategoryId?: number };

export function SectorForm({ sector, categories, defaultCategoryId }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSectorAction, null);
  const [b2c, setB2c] = useState(sector?.b2cSuitability ?? 50);
  const [b2b, setB2b] = useState(sector?.b2bSuitability ?? 50);
  const [b2g, setB2g] = useState(sector?.b2gSuitability ?? 50);

  return (
    <form action={formAction}>
      {sector ? <input type="hidden" name="id" value={sector.id} /> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          {sector ? `Edit ${sector.name}` : 'New sector'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/sectors"
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
            <Label htmlFor="categoryId">Category *</Label>
            <Select id="categoryId" name="categoryId" required defaultValue={sector?.categoryId ?? defaultCategoryId ?? ''}>
              <option value="" disabled>Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={sector?.name ?? ''} />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" placeholder="auto-generated" defaultValue={sector?.slug ?? ''} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={sector?.description ?? ''} />
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h3 className="font-semibold">Audience suitability</h3>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label>B2C — {b2c}</Label>
              <input type="range" name="b2cSuitability" min={0} max={100} value={b2c} onChange={(e) => setB2c(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div>
              <Label>B2B — {b2b}</Label>
              <input type="range" name="b2bSuitability" min={0} max={100} value={b2b} onChange={(e) => setB2b(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div>
              <Label>B2G — {b2g}</Label>
              <input type="range" name="b2gSuitability" min={0} max={100} value={b2g} onChange={(e) => setB2g(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="typicalRiskLevel">Typical risk level</Label>
              <Select id="typicalRiskLevel" name="typicalRiskLevel" defaultValue={sector?.typicalRiskLevel ?? ''}>
                <option value="">Not set</option>
                {RISK_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="narrativeFit">Narrative fit</Label>
              <Select id="narrativeFit" name="narrativeFit" defaultValue={sector?.narrativeFit ?? ''}>
                <option value="">Not set</option>
                {NARRATIVE_FIT_LEVELS.map((level) => (
                  <option key={level} value={level} className="capitalize">{level}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="position">Position</Label>
              <Input id="position" name="position" type="number" defaultValue={sector?.position ?? 0} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox name="isActive" defaultChecked={sector?.isActive ?? true} />
              Active
            </label>
          </div>
          <Hint>Suitability scores (0-100) show how well this sector fits each audience.</Hint>
        </Card>
      </div>
    </form>
  );
}
