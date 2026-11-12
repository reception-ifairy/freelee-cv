'use client';

import { useActionState } from 'react';
import { declareAdultAction, resendVerificationAction } from '@/server/actions/children';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Checkbox, FormMessage } from '@/components/ui/field';

export function ResendVerification() {
  const [state, action] = useActionState<ActionState, FormData>(() => resendVerificationAction(), null);
  return (
    <Card className="p-5 text-sm">
      <p className="font-medium">Please confirm your email address first.</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">We sent you a link when you signed up. A confirmed address lets us reach you about your child’s data.</p>
      <form action={action} className="mt-3 space-y-2">
        <FormMessage state={state} />
        <button type="submit" className="h-9 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-on-brand">Send a new link</button>
      </form>
    </Card>
  );
}

/** Accounts made before the adult declaration existed confirm it once here. */
export function DeclareAdult() {
  const [state, action] = useActionState<ActionState, FormData>(declareAdultAction, null);
  return (
    <Card className="p-5 text-sm">
      <form action={action} className="space-y-3">
        <FormMessage state={state} />
        <label className="flex items-start gap-2">
          <Checkbox name="adult" required className="mt-0.5" />
          <span>I am 18 or over and a parent or legal guardian of the children I add here.</span>
        </label>
        <button type="submit" className="h-9 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-on-brand">Confirm</button>
      </form>
    </Card>
  );
}
