import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from './form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="text-xl font-bold tracking-tight">Link not valid</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          That link is missing its token. Reset links only work in full, straight from the email.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-on-brand hover:bg-brand-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
