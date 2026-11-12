import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { childFeaturesAvailable } from '@/lib/crypto/envelope';
import { listChildren } from '@/lib/children/store';
import { NOT_COLLECTED, SUBJECTS, yearLabel } from '@/lib/children/profile';
import { deleteChildAction } from '@/server/actions/children';
import { ChildForm } from './child-form';
import { ResendVerification, DeclareAdult } from './account-checks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Children' };

const subjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id;

/**
 * Child profiles under a parent's account (docs/54-children-data.md). freelee
 * is for adults; a child learns through a profile, never a login of their own.
 */
export default async function ChildrenPage() {
  const session = await requireUser();
  const [account] = await db.select({ emailVerified: users.emailVerified, adult: users.adultDeclaredAt }).from(users).where(eq(users.id, session.id)).limit(1);
  const available = childFeaturesAvailable();
  const children = available ? await listChildren(session.id) : [];
  const ready = available && Boolean(account?.emailVerified) && Boolean(account?.adult);

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

        {children.map((child) => (
          <Card key={child.id} className="p-6">
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
                <ChildForm id={child.id} profile={child.profile} />
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
            <ChildForm />
          </Card>
        )}
      </div>
    </div>
  );
}
