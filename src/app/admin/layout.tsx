import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink, LogOut } from 'lucide-react';
import { JetBrains_Mono } from 'next/font/google';
import { currentUser } from '@/lib/auth';
import { logoutAction } from '@/server/actions/auth';
import { Logo } from '@/components/site/logo';
import { AdminNav } from '@/components/admin/admin-nav';
import { AdminDrawer } from '@/components/admin/admin-drawer';
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb';

/**
 * The admin's mono face, self-hosted via next/font.
 *
 * It used to be three raw <link> tags inside the JSX, which is render-blocking
 * and re-ships the same stylesheet reference on every admin navigation.
 * next/font inlines the @font-face, preloads the file from our own origin and
 * removes the round trip to Google entirely.
 */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono-admin',
});


export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The middleware already gates /admin; this is the defence-in-depth check
  // that also protects direct server-component rendering.
  const user = await currentUser();
  if (!user) redirect('/login?callbackUrl=/admin');
  if (!user.isAdmin) redirect('/');

  return (
    // The admin console always renders dark — this aesthetic has no light
    // variant, so there's no ThemeToggle here (unlike the public site).
    <div className={`admin-console dark flex min-h-screen bg-slate-100 dark:bg-slate-950 ${mono.variable}`}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-white/10 dark:bg-black">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-white/10">
          <span className="glow-ring flex size-9 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-950/50">
            <Logo className="size-5" />
          </span>
          <span className="font-bold tracking-tight">Freelee</span>
          <span className="ml-auto rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-brand-400">
            admin
          </span>
        </div>

        <div className="flex h-[calc(100%-4rem)] flex-col overflow-y-auto p-3">
          <AdminNav />

          <div className="mt-auto space-y-1 border-t border-slate-200 pt-3 dark:border-white/10">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-[--duration-fast] hover:bg-white/[0.03] hover:text-slate-200"
            >
              <ExternalLink className="size-4 shrink-0" /> View site
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm font-medium text-rose-500 transition-colors duration-[--duration-fast] hover:bg-rose-500/10 hover:text-rose-400"
              >
                {/* Sign out was the one nav row with no icon, so it sat a
                    label-width to the left of everything above it. */}
                <LogOut className="size-4 shrink-0" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-black/60 dark:backdrop-blur-md">
          <AdminDrawer />
          <AdminBreadcrumb />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm font-medium text-slate-400 sm:block">{user.name}</span>
          </div>
        </header>

        {/* Capped: the panel is full of two- and three-column layouts that
            stretch to unreadable line lengths on an ultrawide display. */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
