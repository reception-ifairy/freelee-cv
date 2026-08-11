'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { completePasswordResetAction } from '@/server/actions/password-reset';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Set new password'}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(completePasswordResetAction, null);

  // On success the form is replaced by a sign-in prompt — leaving the fields
  // up invites a second submit that would fail, since the token is now spent.
  if (state?.success) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-on-brand hover:bg-brand-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required autoFocus autoComplete="new-password" />
        <Hint>At least 8 characters.</Hint>
      </div>
      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
      </div>
      <Submit />
    </form>
  );
}
