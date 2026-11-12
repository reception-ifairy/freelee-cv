import type { Metadata } from 'next';
import { ExitForm } from './exit-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leave child mode' };

export default function ExitChildModePage() {
  return (
    <div className="container-app py-10">
      <div className="mx-auto max-w-sm">
        <h1 className="text-xl font-bold tracking-tight">Grown-ups only</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Enter your account password to leave child mode.</p>
        <ExitForm />
      </div>
    </div>
  );
}
