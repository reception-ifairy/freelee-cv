import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { childFeaturesAvailable } from '@/lib/crypto/envelope';
import { listChildren } from '@/lib/children/store';
import { NOT_COLLECTED, yearLabel } from '@/lib/children/profile';
import { getExamsCache, getSubjectsDictionary } from '@/lib/curriculum/subjects-cache';
import { BARRIER_LABEL, monthsUntil, sittingLabel, type ExamOption } from '@/lib/children/exams';
import { subjectLabel as labelOf, subjectOptions } from '@/lib/curriculum/subjects';
import { deleteChildAction, refreshPlanAction, startLearningAction } from '@/server/actions/children';
import { childContext } from '@/lib/children/child-mode';
import { loadPlan } from '@/lib/children/plan';
import { and, desc } from 'drizzle-orm';
import { chats, personas } from '@/db/schema';
import { LESSON_DAYS } from '@/lib/children/retention';
import { ChildForm } from './child-form';
import { ResendVerification, DeclareAdult } from './account-checks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Children' };


/**
 * Child profiles under a parent's account (docs/54-children-data.md). freelee
 * is for adults; a child learns through a profile, never a login of their own.
 */
export default async function ChildrenPage() {
  const session = await requireUser();
  const [account] = await db.select({ emailVerified: users.emailVerified, adult: users.adultDeclaredAt }).from(users).where(eq(users.id, session.id)).limit(1);
  const available = childFeaturesAvailable();
  const children = available ? await listChildren(session.id) : [];
  // The curriculum's subject dictionary after a Fetch, the built-in list before (2026-11-14).
  const options = subjectOptions(await getSubjectsDictionary());
  const subjectLabel = (id: string) => labelOf(id, options);
  // School years change in September: exam goals are worked out from the year in the profile.
  const newSchoolYear = [8, 9].includes(new Date().getUTCMonth());
  const examsCache = await getExamsCache();
  const exams = (examsCache?.exams ?? []) as ExamOption[];
  const boards = examsCache?.boards ?? {};
  // The plan summary per child: what each subject is on now (decrypted for the parent only).
  const plans = new Map(
    await Promise.all(children.map(async (c) => {
      const ctx = await childContext(session.id, c.id);
      return [c.id, ctx ? await loadPlan(ctx.row, ctx.key) : null] as const;
    })),
  );
  const ready = available && Boolean(account?.emailVerified) && Boolean(account?.adult);
  // Lessons per child, newest first — the full transcripts open for the parent only (owner decision 2026-11-12).
  const lessons = new Map(
    await Promise.all(children.map(async (c) => [c.id, await db
      .select({ id: chats.id, title: chats.title, lastMessageAt: chats.lastMessageAt, count: chats.messagesCount, tutor: personas.name })
      .from(chats)
      .leftJoin(personas, eq(personas.id, chats.personaId))
      .where(and(eq(chats.childProfileId, c.id), eq(chats.userId, session.id)))
      .orderBy(desc(chats.lastMessageAt))
      .limit(20)] as const)),
  );

  return (
    <div className="container-app py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Children</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Each child gets one learning plan, built from the UK curriculum for their school year and shared by every tutor they talk to.
            Profiles are encrypted on our own server; you can change, export or delete them at any time.
          </p>
          <p className="mt-2 text-xs text-slate-500">We never ask for: {NOT_COLLECTED.join(', ')}.</p>
        </div>

        {!available && (
          <Card className="p-5 text-sm">Child profiles are not available on this server yet. Nothing is stored until they are.</Card>
        )}
        {available && !account?.emailVerified && <ResendVerification />}
        {available && account?.emailVerified && !account?.adult && <DeclareAdult />}

        {newSchoolYear && children.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            A new school year: please check the year in each profile, then refresh the plan — exam goals are worked out from it.
          </p>
        )}
        {children.map((child) => (
          <Card key={child.id} className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {ready && (
                <form action={startLearningAction}>
                  <input type="hidden" name="id" value={child.id} />
                  <button type="submit" className="h-9 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-on-brand">Start learning as {child.profile.pseudonym}</button>
                </form>
              )}
              <form action={refreshPlanAction}>
                <input type="hidden" name="id" value={child.id} />
                <button type="submit" className="h-9 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700">{plans.get(child.id) ? 'Refresh plan' : 'Build plan'}</button>
              </form>
            </div>
            {plans.get(child.id) ? (
              <ul className="mb-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {plans.get(child.id)!.subjects.map((s) => {
                  const unit = s.units.find((u) => u.unitId === s.current) ?? s.units[0];
                  const done = s.units.filter((u) => plans.get(child.id)!.progress[u.unitId]?.status === 'secure').length;
                  return (
                    <li key={s.subject}>
                      <span className="font-medium">{subjectLabel(s.subject)}:</span> now {unit?.title ?? '—'} · {s.units.length} topics this year{done ? `, ${done} secure` : ''}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No learning plan yet.</p>
            )}
            {(plans.get(child.id)?.targets ?? []).length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium">Exam goals</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {plans.get(child.id)!.targets!.map((t) => {
                    const months = t.sitting ? monthsUntil(t.sitting) : null;
                    return (
                      <li key={`${t.exam}-${t.level ?? ''}`}>
                        <span className="font-medium">{t.title}</span>
                        {t.sitting ? ` · ${sittingLabel(t.sitting)}` : ''}
                        {months !== null && months > 0 ? ` · ${months} month${months === 1 ? '' : 's'} to go` : ''}
                        {t.coverage ? ` · ${t.coverage.units} topics, about ${t.coverage.estSessions} sessions until then` : ''}
                        {t.homeEducation.barriers.length ? <span className="block text-xs">Needs {t.homeEducation.barriers.map((b) => BARRIER_LABEL[b] ?? b).join(', ')}.</span> : null}
                        {t.notes.map((n) => <span key={n} className="block text-xs text-slate-500">{n}</span>)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {(lessons.get(child.id) ?? []).length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium">Lessons <span className="font-normal text-slate-500">(kept {LESSON_DAYS} days after the last message)</span></p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {lessons.get(child.id)!.map((l) => (
                    <li key={l.id}>
                      <a href={`/chat/${l.id}`} className="text-brand-600 hover:underline">{l.tutor ?? l.title ?? 'Lesson'}</a>{' '}
                      <span className="text-slate-500">· {l.lastMessageAt.toLocaleDateString('en-GB')} · {l.count} messages</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mb-4 text-sm">
              <a href={`/dashboard/children/${child.id}/export`} className="text-brand-600 hover:underline">Download everything about {child.profile.pseudonym} (JSON)</a>
            </p>
            <details>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{child.profile.pseudonym}</h2>
                  <span className="text-sm text-slate-500">
                    {yearLabel(child.profile.year)} · {child.profile.subjects.map(subjectLabel).join(', ')}
                  </span>
                </div>
                <span className="mt-1 block text-xs text-brand-600">Edit profile</span>
              </summary>
              <div className="mt-6">
                <ChildForm id={child.id} profile={child.profile} subjectOptions={options} exams={exams} boards={boards} />
                <form action={deleteChildAction} className="mt-8 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <input type="hidden" name="id" value={child.id} />
                  <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" name="confirm" required className="mt-0.5" />
                    Delete {child.profile.pseudonym}’s profile, learning plan and chats. This cannot be undone.
                  </label>
                  <button type="submit" className="mt-3 h-9 rounded-xl border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950">
                    Delete profile
                  </button>
                </form>
              </div>
            </details>
          </Card>
        ))}

        {ready && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">{children.length ? 'Add another child' : 'Add your child'}</h2>
            <ChildForm subjectOptions={options} exams={exams} boards={boards} />
          </Card>
        )}
      </div>
    </div>
  );
}
