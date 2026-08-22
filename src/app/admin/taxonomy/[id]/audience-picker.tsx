'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/field';
import { AUDIENCE_SEGMENTS } from '@/lib/persona/audience-segments';
import { setCategoryAudiencesAction } from '@/server/actions/admin-taxonomy';

/**
 * Which of the 70 audiences this field serves.
 *
 * The link is editorial judgement and cannot be derived: sector suitability
 * says "this field sells well to business", which does not tell you *which*
 * businesses. So it is picked, and picking it is the point — what lands here
 * goes straight into the brief a specialist gets designed against, and a wrong
 * audience is worse than none.
 *
 * Each option shows what the segment actually implies, not just its name. That
 * is a deliberate departure from the persona form, where the same 70 codes
 * appear as bare labels and the reader is expected to already know what a
 * "SEND Learner" needs.
 */
export function AudiencePicker({
  categoryId,
  selected,
}: {
  categoryId: number;
  selected: { code: string; note: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<Set<string>>(new Set(selected.map((s) => s.code)));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const all = Object.values(AUDIENCE_SEGMENTS);
  const chosen = [...codes].flatMap((code) => (AUDIENCE_SEGMENTS[code] ? [AUDIENCE_SEGMENTS[code]] : []));
  const noteOf = new Map(selected.map((s) => [s.code, s.note]));

  const toggle = (code: string) =>
    setCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">Who this field serves</h2>
        <button
          type="button"
          className="text-xs text-slate-500 underline-offset-2 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Done choosing' : 'Choose audiences'}
        </button>
      </div>

      {chosen.length === 0 && !open ? (
        <Card padding="sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nobody has decided yet. Until an audience is attached, a bot designed here is designed for
            everyone — which usually means nobody.
          </p>
        </Card>
      ) : null}

      {chosen.length > 0 ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {chosen.map((segment) => (
            <Card key={segment.code} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{segment.name}</p>
                <Badge tone="slate">{segment.audienceType}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Needs {segment.keyNeeds.slice(0, 4).map((n) => n.replace(/_/g, ' ')).join(', ')}
              </p>
              {noteOf.get(segment.code) ? (
                <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">
                  {noteOf.get(segment.code)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {open ? (
        <Card padding="md">
          <div className="max-h-96 overflow-y-auto pe-1">
            {(['B2C', 'B2B', 'B2G'] as const).map((type) => (
              <div key={type} className="mb-4">
                <p className="eyebrow mb-2">{type}</p>
                <div className="grid gap-1.5">
                  {all
                    .filter((s) => s.audienceType === type)
                    .map((segment) => (
                      <label key={segment.code} className="flex cursor-pointer items-start gap-2 text-sm">
                        <Checkbox
                          checked={codes.has(segment.code)}
                          onChange={() => toggle(segment.code)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          {segment.name}
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {segment.keyNeeds.slice(0, 3).map((n) => n.replace(/_/g, ' ')).join(', ')}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            className="mt-3 w-full"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setCategoryAudiencesAction(categoryId, [...codes]);
                setMessage(result?.success ?? result?.error ?? null);
                setOpen(false);
                router.refresh();
              })
            }
          >
            Save audiences
          </Button>
        </Card>
      ) : null}

      {message ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{message}</p> : null}
    </section>
  );
}
