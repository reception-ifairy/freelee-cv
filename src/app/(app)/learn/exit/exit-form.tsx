'use client';

import { useActionState } from 'react';
import { exitChildModeAction } from '@/server/actions/children';
import type { ActionState } from '@/server/actions/auth';
import { FormMessage, Input } from '@/components/ui/field';

export function ExitForm() {
  const [state, action] = useActionState<ActionState, FormData>(exitChildModeAction, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <FormMessage state={state} />
      <Input name="password" type="password" required autoComplete="current-password" aria-label="Password" />
      <button type="submit" className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand">Leave child mode</button>
    </form>
  );
}
