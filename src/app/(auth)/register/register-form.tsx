'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { registerAction, type ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(registerAction, null);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <FormMessage state={state} />

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required autoFocus autoComplete="name" />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
        <Hint>At least 8 characters, with letters and numbers.</Hint>
      </div>

      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox name="terms" className="mt-0.5" required />
        <span className="text-slate-600 dark:text-slate-300">
          I agree to the{' '}
          <Link href="/terms" className="text-brand-600 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <SubmitButton />
    </form>
  );
}
