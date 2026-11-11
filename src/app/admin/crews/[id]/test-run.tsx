'use client';

import { startTransition, useActionState } from 'react';
import { CircleCheck, CircleX, Play, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormMessage, Hint, Label, Textarea } from '@/components/ui/field';
import { startAdminCrewRunAction } from '@/server/actions/admin-crews';
import type { ActionState } from '@/server/actions/auth';
import type { ReadinessCheck } from '@/modules/crews/readiness';
import { cn } from '@/lib/utils';

/**
 * Give the team a task and start it — with the pre-check shown first.
 *
 * The checks are computed on the server (`crewReadiness`) and only displayed
 * here. Start stays disabled while any fails, with the reason beside it rather
 * than in a tooltip, because "why can't I press this" is exactly the question
 * a disabled button raises. The action runs the same checks again on submit.
 */
export function TestRun({
  crewId,
  checks,
  ready,
  blocker,
}: {
  crewId: string;
  checks: ReadinessCheck[];
  ready: boolean;
  blocker: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(startAdminCrewRunAction, null);

  // By hand rather than `<form action>`: React 19 clears a form once its
  // action returns, so a refused start ("Describe the task…") would also
  // throw away the task that was typed.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="font-semibold">Test run</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Give the team a task and watch it work. A run spends real credits, up to the team&apos;s budget.
      </p>

      <div className="mt-4 rounded-control border hairline p-3">
        <p className="eyebrow mb-2">Before you start</p>
        <ul className="space-y-1.5">
          {checks.map((check) => {
            const Icon = !check.ok ? CircleX : check.warning ? TriangleAlert : CircleCheck;
            return (
              <li key={check.label} className="flex items-start gap-2 text-sm">
                <Icon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    !check.ok ? 'text-rose-500' : check.warning ? 'text-amber-500' : 'text-emerald-500',
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="sr-only">{!check.ok ? 'Problem: ' : check.warning ? 'Note: ' : 'OK: '}</span>
                  {check.label}
                  {check.detail ? <span className="block text-xs text-slate-500 dark:text-slate-400">{check.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <input type="hidden" name="crewId" value={crewId} />
        <div>
          <Label htmlFor="run-input">What should the team work on?</Label>
          <Textarea
            id="run-input"
            name="input"
            rows={3}
            maxLength={4000}
            placeholder="e.g. Write a 300-word blog post about choosing a first electric bike."
          />
        </div>

        <FormMessage state={state} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={!ready} loading={pending} className="sm:w-auto">
            <Play /> Start test run
          </Button>
          {ready ? (
            <Hint className="mt-0">It runs in the background; you&apos;ll be taken to a page that updates as it goes.</Hint>
          ) : (
            <p className="text-xs text-rose-600 dark:text-rose-400">Can&apos;t start yet: {blocker}</p>
          )}
        </div>
      </form>
    </Card>
  );
}
