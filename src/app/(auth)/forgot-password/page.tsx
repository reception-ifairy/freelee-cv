import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Enter the address you signed up with and we&apos;ll send you a link.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
