'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { saveChildAction } from '@/server/actions/children';
import type { ActionState } from '@/server/actions/auth';
import { Checkbox, FormMessage, Input, Label, Select, Textarea } from '@/components/ui/field';
import { ADAPTATIONS, FIELD_NOTES, NOTES_NOTE, YEARS, isGcseYear, yearLabel, type ChildProfile, type FieldNote } from '@/lib/children/profile';
import { FALLBACK_SUBJECTS, displayLabel, hasParts, subjectsForYear, type SubjectOption } from '@/lib/curriculum/subjects';
import { BARRIER_LABEL, FAMILY_LABEL, FORM_TARGETS, examLabel, examsForYear, type ExamOption, type ExamTarget } from '@/lib/children/exams';

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

const ACCESS_TEXT: Record<string, string> = {
  'practice-only': 'Schools give this test; at home it is practice with the published papers.',
  none: 'Not open to home-educated children, and no practice version is published.',
  'private-candidate': 'Sat as a private candidate at an exam centre that accepts them.',
  centre: 'Taken through a centre or training provider that offers it.',
  provider: 'Booked with the exam body.',
  'local-admissions': 'Through the local admissions process.',
};

/** One target exam: which exam, the month it is sat, and its tier or level when it has them. */
function TargetRow({ i, prefix, exams, boards, target }: { i: number; prefix: string; exams: ExamOption[]; boards: Record<string, string>; target?: ExamTarget }) {
  const [examId, setExamId] = useState(target?.exam ?? '');
  const exam = exams.find((e) => e.id === examId);
  const families = (['school-check', 'entrance', 'qualification', 'graded'] as const).filter((f) => exams.some((e) => e.family === f));
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr] dark:border-slate-800">
      <div>
        <Label htmlFor={`${prefix}targetExam${i}`}>Exam {i + 1}</Label>
        <Select id={`${prefix}targetExam${i}`} name={`targetExam${i}`} value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">None</option>
          {families.map((f) => (
            <optgroup key={f} label={FAMILY_LABEL[f]}>
              {exams.filter((e) => e.family === f).map((e) => <option key={e.id} value={e.id}>{examLabel(e, boards)}</option>)}
            </optgroup>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}targetSitting${i}`}>Month</Label>
        <Input id={`${prefix}targetSitting${i}`} name={`targetSitting${i}`} type="month" defaultValue={target?.sitting} />
      </div>
      <div>
        {exam?.tiers?.length ? (
          <>
            <Label htmlFor={`${prefix}targetTier${i}`}>Tier</Label>
            <Select id={`${prefix}targetTier${i}`} name={`targetTier${i}`} defaultValue={target?.tier ?? ''}>
              <option value="">Not sure</option>
              {exam.tiers.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </>
        ) : exam?.levels?.length ? (
          <>
            <Label htmlFor={`${prefix}targetLevel${i}`}>Grade or level</Label>
            <Select id={`${prefix}targetLevel${i}`} name={`targetLevel${i}`} defaultValue={target?.level ?? ''}>
              <option value="">Not sure</option>
              {exam.levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </Select>
          </>
        ) : null}
      </div>
      {exam && (
        <p className="text-xs text-slate-600 sm:col-span-3 dark:text-slate-400">
          {ACCESS_TEXT[exam.access] ?? ''}
          {exam.barriers.length ? ` Needs ${exam.barriers.map((b) => BARRIER_LABEL[b] ?? b).join(', ')}.` : ''}
          {!exam.verified ? ' Format not checked at source yet.' : ''}
        </p>
      )}
    </div>
  );
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60">
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function ChildForm({ id, profile, subjectOptions = FALLBACK_SUBJECTS, exams = [], boards = {} }: { id?: string; profile?: ChildProfile; subjectOptions?: SubjectOption[]; exams?: ExamOption[]; boards?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveChildAction, null);
  const [year, setYear] = useState<string>(profile?.year ?? 'Y4');
  // From the curriculum's subject dictionary (2026-11-14): parts such as biology show what they belong to.
  const subjects = subjectsForYear(subjectOptions, year);
  const prefix = id ? `c-${id.slice(0, 8)}-` : 'new-';
  const formRef = useRef<HTMLFormElement>(null);
  // A new profile was created: clear the "add" form for the next child (an edit keeps its values).
  useEffect(() => {
    if (state?.success && !id) formRef.current?.reset();
  }, [state, id]);

  return (
    // Submitted through onSubmit, not the form's `action`: React resets a form after an action, so a
    // parent who hit a message (a missing consent box) would lose everything they had typed.
    <form
      ref={formRef}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
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
              {displayLabel(s, subjectOptions)}
            </label>
          ))}
        </div>
        {hasParts(subjects) && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Some subjects are part of another (e.g. Biology is part of Science). Choose either, or both: each topic is planned once — the part takes its own topics and the whole subject keeps the rest.
          </p>
        )}
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

      {exams.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">Exam goals (optional)</legend>
          <div className="mt-2 space-y-2">
            {Array.from({ length: FORM_TARGETS }, (_, i) => (
              <TargetRow key={i} i={i} prefix={prefix} exams={examsForYear(exams, year)} boards={boards} target={profile?.targets?.[i]} />
            ))}
          </div>
          <Note note={FIELD_NOTES.targets} />
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
        <Label htmlFor={`${prefix}notes`}>Anything else? (optional, used once)</Label>
        <Textarea id={`${prefix}notes`} name="notes" rows={3} maxLength={1200} placeholder="e.g. gets tired quickly after school; likes to see things drawn out" />
        <Note note={NOTES_NOTE} />
        <label className="mt-2 flex items-start gap-2 text-sm">
          <Checkbox name="notesConsent" className="mt-0.5" />
          <span>I agree that these words are sent once to the AI service to pick adaptations from the list above, and then deleted.</span>
        </label>
      </div>

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

      <Submit label={id ? 'Save profile' : 'Create profile'} pending={pending} />
    </form>
  );
}
