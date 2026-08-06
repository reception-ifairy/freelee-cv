'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { testKnowledgeSourceAction } from '@/server/actions/admin-knowledge-sources';
import type { ActionState } from '@/server/actions/auth';
import { Input, FormMessage } from '@/components/ui/field';

function TestSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {pending ? 'Testing…' : 'Test'}
    </button>
  );
}

/** Fires a real search through the exact code path a chat turn uses — immediate feedback that the dot-paths are configured correctly, no persona/chat needed to find out. */
export function TestButton({ sourceKey }: { sourceKey: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(testKnowledgeSourceAction, null);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="key" value={sourceKey} />
      <div className="flex gap-2">
        <Input name="query" placeholder="Test query…" required className="h-8 text-xs" />
        <TestSubmitButton />
      </div>
      <FormMessage state={state} />
    </form>
  );
}
