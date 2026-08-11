'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/server/actions/auth';
import { FormMessage } from '@/components/ui/field';
import { Card } from '@/components/ui/card';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * Wraps the "create/edit" side panel that several admin screens share, so the
 * pending state and error rendering live in one place instead of six.
 */
export function InlineForm({
  action,
  title,
  submitLabel = 'Save',
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  title: string;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);

  return (
    <Card className="h-fit p-5">
      <form action={formAction} className="space-y-4">
        <h2 className="font-semibold">{title}</h2>
        <FormMessage state={state} />
        {children}
        <SubmitButton label={submitLabel} />
      </form>
    </Card>
  );
}
