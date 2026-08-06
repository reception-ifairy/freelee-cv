import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './register-form';
import { getSettingInt } from '@/lib/settings';
import { formatCredits } from '@/lib/utils';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage() {
  const bonus = await getSettingInt('signup_bonus_credits', Number(process.env.SIGNUP_BONUS_CREDITS ?? 250));

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Start with {formatCredits(bonus)} free credits. No card required.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
