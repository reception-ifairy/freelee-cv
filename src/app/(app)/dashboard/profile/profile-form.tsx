'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfileAction } from '@/server/actions/profile';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';
import { Card } from '@/components/ui/card';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

type Props = { name: string; email: string; timezone: string };

export function ProfileForm({ name, email, timezone }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateProfileAction, null);

  return (
    <Card className="mt-6 p-6">
      <form action={formAction} className="space-y-5">
        <FormMessage state={state} />

        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" defaultValue={email} disabled />
          <Hint>Contact support to change the email on your account.</Hint>
        </div>

        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={timezone} placeholder="Europe/Warsaw" />
        </div>

        <SubmitButton />
      </form>
    </Card>
  );
}
