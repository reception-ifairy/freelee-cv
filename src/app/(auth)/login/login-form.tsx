'use client';

import Link from 'next/link';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '@/server/actions/auth';
import { Input, Label, Checkbox, FormMessage } from '@/components/ui/field';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, null);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <FormMessage state={state} />

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus autoComplete="username" />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
        <p className="mt-2 text-right text-xs">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Forgot your password?
          </Link>
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="remember" />
        Keep me signed in
      </label>

      <SubmitButton />
    </form>
  );
}
