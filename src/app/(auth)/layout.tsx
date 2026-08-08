import Link from 'next/link';
import { Logo } from '@/components/site/logo';
import { getActiveTheme } from '@/lib/branding/theme';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const theme = await getActiveTheme();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="aurora absolute inset-0 -z-10" />
      <div className="grid-fade absolute inset-0 -z-10" />

      <div className="animate-in-up w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo srcUrl={theme?.logoUrl} />
            <span className="text-xl font-bold tracking-tight">Freelee</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Freelee
        </p>
      </div>
    </div>
  );
}
