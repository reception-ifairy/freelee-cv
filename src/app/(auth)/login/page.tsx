import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Sign in to continue your conversations.
      </p>

      <LoginForm redirectTo={callbackUrl} />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No account yet?{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
