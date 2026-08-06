import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <div className="aurora absolute inset-0 -z-10" />
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
