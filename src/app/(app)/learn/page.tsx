import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { activeChildId, childContext, ensurePlan } from '@/lib/children/child-mode';
import { lessonTutorsFor } from '@/lib/children/tutors';
import { deliveryNotice, yearLabel } from '@/lib/children/profile';
import { getSubjectsDictionary } from '@/lib/curriculum/subjects-cache';
import { sameFamily, subjectLabel, subjectOptions } from '@/lib/curriculum/subjects';
import { startLessonAction } from '@/server/actions/chat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Learn' };

/** The child's home in child mode (docs/54): their tutors, what they are learning now, and who can read the chats. */
export default async function LearnPage() {
  const user = await requireUser();
  const childId = await activeChildId(user.id);
  const ctx = childId ? await childContext(user.id, childId) : null;
  // No valid child for this account (e.g. another parent signed in on this device): the cookie must go.
  if (!ctx) redirect('/learn/exit');
  const { plan } = await ensurePlan(ctx).catch(() => ({ plan: null }));
  const tutors = await lessonTutorsFor(ctx.profile.year, user.isAdmin);
  const dict = await getSubjectsDictionary();
  const options = subjectOptions(dict);
  const label = (id: string) => subjectLabel(id, options);
  // Subjects of the child's plan that no tutor teaches yet: said plainly, never hidden (2026-11-14).
  const untaught = ctx.profile.subjects.filter((s) => !tutors.some((t) => t.subjects.some((ts) => sameFamily(ts, s, dict))));

  return (
    <div className="container-app py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Hello, {ctx.profile.pseudonym}!</h1>
          <Link href="/learn/exit" className="text-sm text-slate-500 hover:underline">Grown-ups: leave</Link>
        </div>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Your grown-up can read our chats. Tutors are computer programs (AI), not people.
          {deliveryNotice(ctx.profile.year) ? <span className="mt-1 block font-medium">{deliveryNotice(ctx.profile.year)}</span> : null}
        </p>

        {plan && (
          <Card className="p-5">
            <h2 className="font-semibold">What you are learning now · {yearLabel(ctx.profile.year)}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {plan.subjects.map((s) => {
                const unit = s.units.find((u) => u.unitId === s.current) ?? s.units[0];
                return unit ? <li key={s.subject}><span className="font-medium">{label(s.subject)}:</span> {unit.title}</li> : null;
              })}
            </ul>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {tutors.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <h3 className="font-semibold">{t.name}{!t.active && <span className="ml-2 text-xs font-normal text-slate-500">(test — admin only)</span>}</h3>
              {t.tagline && <p className="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-300">{t.tagline}</p>}
              <p className="mt-2 text-xs text-slate-500">{t.subjects.map(label).join(', ')}</p>
              <form action={startLessonAction} className="mt-3">
                <input type="hidden" name="persona" value={t.slug} />
                <button type="submit" className="h-9 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-on-brand">Start a lesson</button>
              </form>
            </Card>
          ))}
          {tutors.length === 0 && <Card className="p-5 text-sm">No tutors for {yearLabel(ctx.profile.year)} yet.</Card>}
        </div>
        {tutors.length > 0 && untaught.length > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">No tutor for {untaught.map(label).join(', ')} yet.</p>
        )}
      </div>
    </div>
  );
}
