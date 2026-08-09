'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordResetAction } from '@/server/actions/password-reset';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, FormMessage } from '@/components/ui/field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(requestPasswordResetAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus autoComplete="email" />
      </div>
      <Submit />
    </form>
  );
}
