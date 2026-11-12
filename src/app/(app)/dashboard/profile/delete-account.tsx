'use client';

import { useActionState } from 'react';
import { deleteAccountAction } from '@/server/actions/children';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Checkbox, FormMessage, Input, Label } from '@/components/ui/field';

/** Deleting the account (docs/54): children's profiles, plans and lessons, all chats and personal details go; billing records stay, anonymous. */
export function DeleteAccount() {
  const [state, action] = useActionState<ActionState, FormData>(deleteAccountAction, null);
  return (
    <Card className="mt-8 border-red-200 p-6 dark:border-red-900">
      <h2 className="text-lg font-semibold">Delete my account</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Deletes every child profile with its learning plan and lessons, all your chats, and your name, email and password.
        Payment records stay, without your name, because the law requires them. This cannot be undone.
      </p>
      <form action={action} className="mt-4 space-y-3">
        <FormMessage state={state} />
        <div>
          <Label htmlFor="delete-password">Password</Label>
          <Input id="delete-password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox name="confirm" required className="mt-0.5" />
          <span>I understand that everything listed above is deleted.</span>
        </label>
        <button type="submit" className="h-10 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950">
          Delete my account
        </button>
      </form>
    </Card>
  );
}
