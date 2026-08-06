'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { savePackAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import type { CreditPack } from '@/db/schema';
import { Card } from '@/components/ui/card';
import { Input, Textarea, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save pack'}
    </button>
  );
}

export function PackForm({ pack }: { pack?: CreditPack }) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePackAction, null);
  const features = [0, 1, 2].map((i) => pack?.features[i] ?? '');

  return (
    <form action={formAction}>
      {pack ? <input type="hidden" name="id" value={pack.id} /> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          {pack ? `Edit ${pack.name}` : 'New credit pack'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/packs"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <SaveButton />
        </div>
      </div>

      <FormMessage state={state} />

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={pack?.name} placeholder="Starter" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={pack?.description ?? ''} />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                required
                defaultValue={pack ? (pack.priceCents / 100).toFixed(2) : '9.00'}
              />
            </div>
            <div>
              <Label htmlFor="compareAtPrice">Compare-at price</Label>
              <Input
                id="compareAtPrice"
                name="compareAtPrice"
                type="number"
                step="0.01"
                defaultValue={pack?.compareAtCents ? (pack.compareAtCents / 100).toFixed(2) : ''}
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue={pack?.currency ?? 'USD'} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="credits">Credits *</Label>
              <Input id="credits" name="credits" type="number" required defaultValue={pack?.credits ?? 1000} />
            </div>
            <div>
              <Label htmlFor="bonusCredits">Bonus credits</Label>
              <Input
                id="bonusCredits"
                name="bonusCredits"
                type="number"
                defaultValue={pack?.bonusCredits ?? 0}
              />
            </div>
          </div>

          <div>
            <Label>Feature bullets</Label>
            <div className="space-y-2">
              {features.map((feature, index) => (
                <Input
                  key={index}
                  name="features"
                  defaultValue={feature}
                  placeholder={`Feature ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Merchandising</h2>
            <div>
              <Label htmlFor="badge">Badge</Label>
              <Input id="badge" name="badge" defaultValue={pack?.badge ?? ''} placeholder="Most popular" />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <Input id="tier" name="tier" type="number" min={1} max={5} defaultValue={pack?.tier ?? 1} />
            </div>
            <div>
              <Label htmlFor="position">Sort position</Label>
              <Input id="position" name="position" type="number" defaultValue={pack?.position ?? 0} />
            </div>
            <label className="flex items-center justify-between pt-2 text-sm">
              <span>Active</span>
              <Checkbox name="isActive" defaultChecked={pack?.isActive ?? true} />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Highlight as featured</span>
              <Checkbox name="isFeatured" defaultChecked={pack?.isFeatured ?? false} />
            </label>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Note</h2>
            <Hint>
              Money is stored in minor units. Enter the price the customer pays, e.g. 29.00 — never 2900.
            </Hint>
          </Card>
        </aside>
      </div>
    </form>
  );
}
