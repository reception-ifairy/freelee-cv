'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { acceptInvitationAction } from '@/server/actions/team';
import type { ActionState } from '@/server/actions/auth';
import { FormMessage } from '@/components/ui/field';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Joining…' : 'Accept invitation'}
    </button>
  );
}

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(acceptInvitationAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      {state?.success ? null : <SubmitButton />}
    </form>
  );
}
