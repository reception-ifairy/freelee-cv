'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { becomeVendorAction, createListingAction } from '@/server/actions/marketplace';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Textarea, Select, FormMessage, Hint } from '@/components/ui/field';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function BecomeVendorForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(becomeVendorAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="displayName">Vendor name</Label>
        <Input id="displayName" name="displayName" required placeholder="Acme Personas" />
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" rows={3} />
      </div>
      <div>
        <Label htmlFor="payoutEmail">Payout email</Label>
        <Input id="payoutEmail" name="payoutEmail" type="email" />
        <Hint>Informational only this phase — no real payout is executed automatically. See docs/16-marketplace.md.</Hint>
      </div>
      <SubmitButton label="Become a vendor" pendingLabel="Creating…" />
    </form>
  );
}

export function CreateListingForm({ personas }: { personas: { id: number; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createListingAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="personaId">Persona</Label>
        <Select id="personaId" name="personaId" required>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Listing title</Label>
        <Input id="title" name="title" required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div>
        <Label htmlFor="pricingModel">Pricing</Label>
        <Select id="pricingModel" name="pricingModel" defaultValue="free">
          <option value="free">Free</option>
          <option value="credit_markup">Pay as you go (you earn a % of usage credits)</option>
          <option value="one_off" disabled>One-off purchase — not available yet</option>
          <option value="subscription" disabled>Subscription — not available yet</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="creditMarkupPct">Credit markup % (pay-as-you-go only)</Label>
        <Input id="creditMarkupPct" name="creditMarkupPct" type="number" min={0} max={100} step={1} />
      </div>
      <SubmitButton label="Create listing (draft)" pendingLabel="Creating…" />
    </form>
  );
}
