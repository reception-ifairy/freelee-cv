'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { generatePayoutAction } from '@/server/actions/admin-marketplace';
import type { ActionState } from '@/server/actions/auth';
import { Select, Input, Label, FormMessage } from '@/components/ui/field';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {pending ? 'Computing…' : 'Compute payout'}
    </button>
  );
}

export function PayoutForm({ vendors }: { vendors: { id: string; displayName: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(generatePayoutAction, null);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="vendorId">Vendor</Label>
        <Select id="vendorId" name="vendorId" required>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.displayName}</option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <div>
          <Label htmlFor="periodStart">From</Label>
          <Input id="periodStart" name="periodStart" type="date" defaultValue={monthAgo} required />
        </div>
        <div>
          <Label htmlFor="periodEnd">To</Label>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={today} required />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
