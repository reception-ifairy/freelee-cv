'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveChildAction } from '@/server/actions/children';
import type { ActionState } from '@/server/actions/auth';
import { Checkbox, FormMessage, Input, Label, Select } from '@/components/ui/field';
import { ADAPTATIONS, FIELD_NOTES, SUBJECTS, YEARS, isGcseYear, yearLabel, type ChildProfile, type FieldNote } from '@/lib/children/profile';

/** "Why we ask · Where it goes · How long we keep it" under every field (owner decision 2026-11-12). */
function Note({ note }: { note: FieldNote }) {
  return (
    <dl className="mt-1.5 grid gap-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
      <div><dt className="inline font-semibold">Why we ask: </dt><dd className="inline">{note.why}</dd></div>
      <div><dt className="inline font-semibold">Where it goes: </dt><dd className="inline">{note.where}</dd></div>
      <div><dt className="inline font-semibold">How long we keep it: </dt><dd className="inline">{note.howLong}</dd></div>
    </dl>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60">
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function ChildForm({ id, profile }: { id?: string; profile?: ChildProfile }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveChildAction, null);
  const [year, setYear] = useState<string>(profile?.year ?? 'Y4');
  const subjects = SUBJECTS.filter((s) => (!s.from || YEARS.indexOf(year as never) >= YEARS.indexOf(s.from)) && (!s.to || YEARS.indexOf(year as never) <= YEARS.indexOf(s.to)));
  const prefix = id ? `c-${id.slice(0, 8)}-` : 'new-';

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      {id && <input type="hidden" name="id" value={id} />}

      <div>
        <Label htmlFor={`${prefix}pseudonym`}>Nickname</Label>
        <Input id={`${prefix}pseudonym`} name="pseudonym" defaultValue={profile?.pseudonym} required maxLength={24} placeholder="e.g. Tiger" autoComplete="off" />
        <Note note={FIELD_NOTES.pseudonym} />
      </div>

      <div>
        <Label htmlFor={`${prefix}year`}>School year</Label>
        <Select id={`${prefix}year`} name="year" value={year} onChange={(e) => setYear(e.target.value)}>
          {YEARS.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
        </Select>
        <Note note={FIELD_NOTES.year} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Subjects</legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {subjects.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox name="subjects" value={s.id} defaultChecked={profile ? profile.subjects.includes(s.id) : ['mathematics', 'english'].includes(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
        <Note note={FIELD_NOTES.subjects} />
      </fieldset>

      {isGcseYear(year) && (
        <fieldset>
          <legend className="text-sm font-medium">GCSE (optional)</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`${prefix}ks4Start`}>GCSE courses start in</Label>
              <Select id={`${prefix}ks4Start`} name="ks4Start" defaultValue={profile?.pathway?.ks4Start ?? 'unsure'}>
                <option value="unsure">Not sure</option>
                <option value="Y9">Year 9</option>
                <option value="Y10">Year 10</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${prefix}tier`}>Maths/science tier</Label>
              <Select id={`${prefix}tier`} name="tier" defaultValue={profile?.pathway?.tier ?? 'unsure'}>
                <option value="unsure">Not sure</option>
                <option value="foundation">Foundation</option>
                <option value="higher">Higher</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${prefix}scienceRoute`}>Science</Label>
              <Select id={`${prefix}scienceRoute`} name="scienceRoute" defaultValue={profile?.pathway?.scienceRoute ?? 'unsure'}>
                <option value="unsure">Not sure</option>
                <option value="combined">Combined</option>
                <option value="triple">Triple (separate sciences)</option>
              </Select>
            </div>
          </div>
          <Note note={FIELD_NOTES.pathway} />
        </fieldset>
      )}

      <div>
        <Label htmlFor={`${prefix}goals`}>Focus (optional)</Label>
        <Input id={`${prefix}goals`} name="goals" defaultValue={profile?.goals} maxLength={160} placeholder="e.g. times tables before the summer" autoComplete="off" />
        <Note note={FIELD_NOTES.goals} />
      </div>

      <div>
        <Label htmlFor={`${prefix}interests`}>Interests (optional, comma-separated)</Label>
        <Input id={`${prefix}interests`} name="interests" defaultValue={profile?.interests.join(', ')} placeholder="football, dinosaurs, drawing" autoComplete="off" />
        <Note note={FIELD_NOTES.interests} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Adaptations (optional)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ADAPTATIONS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <Checkbox name="adaptations" value={a.id} defaultChecked={profile?.adaptations.includes(a.id)} />
              {a.label}
            </label>
          ))}
        </div>
        <Note note={FIELD_NOTES.adaptations} />
      </fieldset>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox name="includePshe" defaultChecked={profile?.includePshe} className="mt-0.5" />
          <span>Include PSHE topics (health, feelings, friendships, money)</span>
        </label>
        <Note note={FIELD_NOTES.includePshe} />
      </div>

      {!id && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox name="consent" required className="mt-0.5" />
          <span className="text-slate-600 dark:text-slate-300">
            I am this child’s parent or guardian. I agree that this profile is stored encrypted and used only to plan and run their lessons, as described above. I can view, export or delete it at any time.
          </span>
        </label>
      )}

      <Submit label={id ? 'Save profile' : 'Create profile'} />
    </form>
  );
}
