'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { installListingAction, reviewListingAction } from '@/server/actions/marketplace';
import type { ActionState } from '@/server/actions/auth';
import { Textarea, Select, FormMessage } from '@/components/ui/field';

function InstallSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Installing…' : 'Install into my team'}
    </button>
  );
}

export function InstallButton({ listingId }: { listingId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(installListingAction, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      <FormMessage state={state} />
      <InstallSubmitButton />
    </form>
  );
}

function ReviewSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 shrink-0 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {pending ? 'Saving…' : 'Save review'}
    </button>
  );
}

export function ReviewForm({ listingId }: { listingId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewListingAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <FormMessage state={state} />
      <Select name="rating" defaultValue="5" className="h-9 w-32 text-sm">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
        ))}
      </Select>
      <Textarea name="comment" rows={2} placeholder="Optional comment" />
      <ReviewSubmitButton />
    </form>
  );
}
