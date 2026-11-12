'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CurriculumScope } from '@/db/schema';
import { Checkbox, Hint, Label, Select } from '@/components/ui/field';
import { CURRICULUM_TOOL_CATALOG } from '@/lib/tools/catalog';
import { AUDIENCE_SEGMENTS } from '@/lib/persona/audience-segments';
import { KEY_STAGES, KEY_STAGE_SEGMENT, isKeyStage, yearLabel, yearsFor } from '@/lib/curriculum/scope';
// Type only — erased at build, so the parser behind it (and zod) stays out of the browser.
import type { CurriculumScopeCache } from '@/lib/curriculum/stored';
import { cn } from '@/lib/utils';

type Option = { id: string; meta?: string; stale: boolean };

const optionClass =
  'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700';

/**
 * The Curriculum section of the Prompt tab (docs/52-curriculum-tutors.md).
 *
 * A tutor is the persona above — character, voice, way of teaching — plus a
 * scope: the key stages and subjects its curriculum tools may look up. What can
 * be ticked comes from the last **Fetch** on the curriculum connection
 * (`curriculum_scope_cache`), so the form only offers what freelee's key may
 * actually see.
 *
 * Values already stored are always offered too, marked when the last Fetch no
 * longer lists them. Otherwise a stale or emptied cache would render a tutor's
 * subjects unticked and the next Save would quietly strip them.
 *
 * Field names and what they submit are mirrored by scripts/verify-persona-form.ts.
 */
export function PersonaCurriculumSection({
  scope,
  cache,
}: {
  scope: CurriculumScope | null;
  cache: CurriculumScopeCache | null;
}) {
  const [enabled, setEnabled] = useState(scope !== null);
  const [keyStages, setKeyStages] = useState<string[]>(scope?.keyStages ?? []);
  const [subjects, setSubjects] = useState<string[]>(scope?.subjects ?? []);
  const [year, setYear] = useState(scope?.year ?? '');

  const fetchedStages = new Map(
    (cache?.keyStages ?? []).filter((row) => isKeyStage(row.keyStage)).map((row) => [row.keyStage, row]),
  );
  const storedStages = scope?.keyStages ?? [];
  const stageOptions: Option[] = [
    ...KEY_STAGES.filter((stage) => fetchedStages.has(stage) || storedStages.includes(stage)),
    // A stored value that is not a key stage at all is still shown, ticked, so
    // Save refuses it with a message instead of dropping it unseen.
    ...storedStages.filter((stage) => !isKeyStage(stage)),
  ].map((stage) => {
    const row = fetchedStages.get(stage);
    return {
      id: stage,
      meta: row ? `${row.documents} documents · ${row.objectives} objectives` : undefined,
      stale: !row,
    };
  });

  const fetchedSubjects = new Map((cache?.subjects ?? []).map((row) => [row.subject, row]));
  const subjectOptions: Option[] = [...new Set([...fetchedSubjects.keys(), ...(scope?.subjects ?? [])])]
    .sort((a, b) => a.localeCompare(b))
    .map((subject) => {
      const row = fetchedSubjects.get(subject);
      return {
        id: subject,
        meta: row ? `${row.documents} documents · ${row.objectives} objectives` : undefined,
        stale: !row,
      };
    });

  const nothingToOffer = stageOptions.length === 0 && subjectOptions.length === 0;
  const years = yearsFor(keyStages);
  // The select can only hold a year inside the ticked key stages; unticking
  // KS2 while Year 4 is chosen falls back to "any year" rather than submitting
  // a year the server would refuse.
  const shownYear = years.includes(year) ? year : '';
  const segments = keyStages
    .filter(isKeyStage)
    .map((stage) => AUDIENCE_SEGMENTS[KEY_STAGE_SEGMENT[stage]]?.name)
    .filter(Boolean);

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div>
        <h3 className="text-sm font-semibold">Curriculum</h3>
        <Hint className="mt-0.5">
          For tutors. The prompt above makes the character and the way it teaches; with this on, <em>what</em> it
          teaches comes live from the UK curriculum instead of from the model&apos;s memory.
        </Hint>
      </div>

      <label className={optionClass}>
        <Checkbox
          name="curriculumEnabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">Teaches from the curriculum</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Gives this persona two tools — {CURRICULUM_TOOL_CATALOG.map((tool) => tool.label).join(' and ')} — that
            can only look inside the key stages and subjects ticked below.
          </span>
        </span>
      </label>

      {enabled && nothingToOffer ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Connect and Fetch the Curriculum API in Settings first — the key stages and subjects to choose from come
          from there.{' '}
          <Link href="/admin/settings?section=ai" className="font-medium underline underline-offset-2">
            Settings → Providers &amp; keys → Curriculum
          </Link>
        </p>
      ) : null}

      {enabled && !nothingToOffer ? (
        <>
          <div>
            <Label>Key stages</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {stageOptions.map((option) => (
                <label key={option.id} className={optionClass}>
                  <Checkbox
                    name="curriculumKeyStages"
                    value={option.id}
                    checked={keyStages.includes(option.id)}
                    onChange={() => toggle(keyStages, setKeyStages, option.id)}
                    className="mt-0.5"
                  />
                  <OptionText option={option} />
                </label>
              ))}
            </div>
            <Hint>The learner&apos;s stage. The tutor never looks outside it.</Hint>
          </div>

          <div>
            <Label>Subjects</Label>
            <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-700">
              {subjectOptions.map((option) => (
                <label key={option.id} className={cn(optionClass, 'p-2')}>
                  <Checkbox
                    name="curriculumSubjects"
                    value={option.id}
                    checked={subjects.includes(option.id)}
                    onChange={() => toggle(subjects, setSubjects, option.id)}
                    className="mt-0.5"
                  />
                  <OptionText option={option} />
                </label>
              ))}
            </div>
            <Hint>Tick every subject this tutor may teach. A homework helper can have them all.</Hint>
          </div>

          <div className="sm:w-1/2">
            <Label htmlFor="curriculumYear">Year (optional)</Label>
            <Select
              id="curriculumYear"
              name="curriculumYear"
              value={shownYear}
              onChange={(event) => setYear(event.target.value)}
              disabled={years.length === 0}
            >
              <option value="">Any year in the ticked key stages</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {yearLabel(item)}
                </option>
              ))}
            </Select>
            <Hint>For a tutor made for one class. Objectives default to this year.</Hint>
          </div>

          <Hint>
            {segments.length > 0 ? (
              <>
                Saving also adds the matching audience — {segments.join(', ')} — on the Personality tab.{' '}
              </>
            ) : null}
            Don&apos;t also tick a grounding source that points at the curriculum: the tutor would pay twice for the
            same passages.
            {cache ? ` Choices from the last Fetch, ${cache.fetchedAt.slice(0, 10)}.` : null}
          </Hint>
        </>
      ) : null}
    </div>
  );
}

function OptionText({ option }: { option: Option }) {
  return (
    <span className="min-w-0">
      <span className="block text-sm font-medium">{option.id}</span>
      {option.meta ? <span className="block text-xs text-slate-500 dark:text-slate-400">{option.meta}</span> : null}
      {option.stale ? (
        <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          not in the last Fetch
        </span>
      ) : null}
    </span>
  );
}
