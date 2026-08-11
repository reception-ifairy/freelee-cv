'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { setChatControlsAction } from '@/server/actions/chat';
import { Select, Label } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export type ModifierOption = { id: number; type: string; name: string };

/**
 * The conversation controls — how the persona should sound, write, format and
 * behave *in this chat*, without editing the persona itself.
 *
 * Which dials appear is the persona's call: `tone`/`writing`/`output` are
 * capability flags an admin ticks per persona. Interaction style and
 * "when it doesn't know" have no capability flag of their own and are always
 * offered, because they change how safe and how useful an answer is rather
 * than being a stylistic extra.
 *
 * Everything defaults to "As the persona was set up" (submitted as `''`,
 * stored as NULL) so an untouched conversation behaves exactly as it did
 * before these controls existed.
 */
const STYLE_OPTIONS = [
  { id: 'formal', label: 'Formal', hint: 'Precise and businesslike.' },
  { id: 'casual', label: 'Casual', hint: 'Relaxed and conversational.' },
  { id: 'enthusiastic', label: 'Enthusiastic', hint: 'Warm and energetic.' },
  { id: 'concise', label: 'Concise', hint: 'As few words as possible.' },
  { id: 'socratic', label: 'Socratic', hint: 'Answers with questions to make you think.' },
];

const UNKNOWN_OPTIONS = [
  { id: 'admit_ignorance', label: 'Say it does not know', hint: 'Safest — never guesses.' },
  { id: 'educated_guess', label: 'Make an educated guess', hint: 'Offers a best attempt, flagged as such.' },
  { id: 'ask_clarifying', label: 'Ask you a question back', hint: 'Gets more detail before answering.' },
];

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Applying…' : 'Apply to this chat'}
    </button>
  );
}

export function ChatControls({
  chatId,
  modifiers,
  selectedModifierIds,
  interactionStyle,
  approachToUnknown,
  show,
}: {
  chatId: string;
  modifiers: ModifierOption[];
  selectedModifierIds: number[];
  interactionStyle: string | null;
  approachToUnknown: string | null;
  /** Which modifier groups the persona actually offers (its capability flags). */
  show: { tone?: boolean; writing?: boolean; output?: boolean };
}) {
  const [open, setOpen] = useState(false);

  const groups = [
    { type: 'tone', label: 'Tone', enabled: show.tone },
    { type: 'writing', label: 'Writing style', enabled: show.writing },
    { type: 'output', label: 'Output format', enabled: show.output },
    // Length has no capability flag of its own; it rides along with output,
    // which is the flag an admin ticks when they want format control at all.
    { type: 'length', label: 'Length', enabled: show.output },
  ].filter((g) => g.enabled && modifiers.some((m) => m.type === g.type));

  const activeCount =
    selectedModifierIds.length + (interactionStyle ? 1 : 0) + (approachToUnknown ? 1 : 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium"
      >
        <SlidersHorizontal className="size-4 text-slate-400" />
        How should it reply?
        {activeCount > 0 ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {activeCount} set
          </span>
        ) : null}
        <span className="ml-auto text-xs text-slate-400">{open ? <X className="size-4" /> : 'Adjust'}</span>
      </button>

      {open ? (
        <form action={setChatControlsAction} className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-800">
          <input type="hidden" name="chatId" value={chatId} />

          {groups.length > 0 ? (
            <div className={cn('grid gap-3', groups.length > 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
              {groups.map((group) => {
                const options = modifiers.filter((m) => m.type === group.type);
                const current = options.find((o) => selectedModifierIds.includes(o.id));
                return (
                  <div key={group.type}>
                    <Label htmlFor={`mod-${group.type}`}>{group.label}</Label>
                    <Select id={`mod-${group.type}`} name="modifierIds" defaultValue={current ? String(current.id) : ''}>
                      <option value="">As the persona was set up</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="interactionStyle">Interaction style</Label>
              <Select id="interactionStyle" name="interactionStyle" defaultValue={interactionStyle ?? ''}>
                <option value="">As the persona was set up</option>
                {STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="approachToUnknown">When it does not know</Label>
              <Select id="approachToUnknown" name="approachToUnknown" defaultValue={approachToUnknown ?? ''}>
                <option value="">As the persona was set up</option>
                {UNKNOWN_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ApplyButton />
            <p className="text-xs text-slate-400">Applies to this conversation only — the persona itself is unchanged.</p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
