'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { inviteMemberAction } from '@/server/actions/team';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Select, FormMessage } from '@/components/ui/field';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Inviting…' : 'Send invite'}
    </button>
  );
}

export function InviteForm({ teamId }: { teamId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(inviteMemberAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="teamId" value={teamId} />
      <FormMessage state={state} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="teammate@example.com" required />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" defaultValue="member">
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </Select>
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}
