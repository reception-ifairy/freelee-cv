import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmail } from '@/lib/children/verify-email';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm your email' };

/** The link from the verification email (docs/54). Works without being signed in. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; u?: string }> }) {
  const { token = '', u = '' } = await searchParams;
  const ok = token && u ? await confirmEmail(u, token) : false;
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{ok ? 'Email confirmed' : 'This link did not work'}</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        {ok
          ? 'Thank you. You can now add a learning profile for your child.'
          : 'It may have expired or been used already. Sign in and ask for a new link on the Children page.'}
      </p>
      <Link href="/dashboard/children" className="mt-6 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-on-brand">
        Go to Children
      </Link>
    </div>
  );
}
