'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSettingsAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Input, Textarea, Label, Hint, Checkbox, FormMessage } from '@/components/ui/field';
import { SETTINGS_SCHEMA, type Field, type SettingsGroup } from '@/lib/settings-schema';

function SaveButton({ group }: { group: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : `Save ${group} settings`}
    </button>
  );
}

type Props = { group: SettingsGroup; values: Record<string, string | boolean> };

export function SettingsForm({ group, values }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettingsAction, null);
  const fields: Field[] = SETTINGS_SCHEMA[group];

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="__group" value={group} />
        <FormMessage state={state} />

        {fields.map((field) => {
          // Field names carry their type so one generic action handles them all.
          const name = `${field.key}:${field.type}`;

          if (field.type === 'bool') {
            return (
              <div key={field.key}>
                {/* An unchecked box submits nothing, so the key is listed separately. */}
                <input type="hidden" name="__bool" value={field.key} />
                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <span>
                    <span className="block text-sm font-medium">{field.label}</span>
                    {field.help ? <Hint>{field.help}</Hint> : null}
                  </span>
                  <Checkbox name={name} defaultChecked={Boolean(values[field.key])} />
                </label>
              </div>
            );
          }

          if (field.type === 'text') {
            return (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Textarea id={field.key} name={name} rows={4} defaultValue={String(values[field.key] ?? '')} />
                {field.help ? <Hint>{field.help}</Hint> : null}
              </div>
            );
          }

          if (field.type === 'secret') {
            return (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  name={name}
                  type="password"
                  className="font-mono"
                  placeholder="•••••••• (leave blank to keep current)"
                />
                <Hint>Blank leaves the existing value untouched.</Hint>
              </div>
            );
          }

          return (
            <div key={field.key}>
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                name={name}
                type={field.type === 'int' ? 'number' : 'text'}
                defaultValue={String(values[field.key] ?? '')}
              />
              {field.help ? <Hint>{field.help}</Hint> : null}
            </div>
          );
        })}

        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <SaveButton group={group} />
        </div>
      </form>
    </Card>
  );
}
