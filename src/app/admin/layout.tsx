import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutGrid, Sparkles, Tags, Layers, SlidersHorizontal, Package, Receipt, Users,
  PenLine, FileText, Menu as MenuIcon, Settings, Palette, BookOpen, ExternalLink, Cpu,
  RefreshCw, Clock, Store, Languages, Search, LayoutTemplate, LifeBuoy,
} from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { logoutAction } from '@/server/actions/auth';
import { Logo } from '@/components/site/logo';

const SECTIONS = [
  {
    heading: null,
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutGrid }],
  },
  {
    heading: 'AI',
    items: [
      { href: '/admin/personas', label: 'Personas', icon: Sparkles },
      { href: '/admin/ai-models', label: 'AI models', icon: Cpu },
      { href: '/admin/knowledge-sources', label: 'Knowledge sources', icon: Search },
      { href: '/admin/categories', label: 'Categories', icon: Tags },
      { href: '/admin/sectors', label: 'Sectors', icon: Layers },
      { href: '/admin/modifiers', label: 'Prompt modifiers', icon: SlidersHorizontal },
    ],
  },
  {
    heading: 'Commerce',
    items: [
      { href: '/admin/packs', label: 'Credit packs', icon: Package },
      { href: '/admin/plans', label: 'Subscription plans', icon: RefreshCw },
      { href: '/admin/passes', label: 'Access passes', icon: Clock },
      { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
      { href: '/admin/sales', label: 'Sales', icon: Receipt },
      { href: '/admin/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    heading: 'Content',
    items: [
      { href: '/admin/frontpage', label: 'Frontpage', icon: LayoutTemplate },
      { href: '/admin/posts', label: 'Blog', icon: PenLine },
      { href: '/admin/pages', label: 'Pages', icon: FileText },
      { href: '/admin/menus', label: 'Menus', icon: MenuIcon },
    ],
  },
  {
    heading: 'System',
    items: [
      { href: '/admin/translations', label: 'Translations', icon: Languages },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/theme', label: 'Branding', icon: Palette },
      { href: '/admin/handbook', label: 'Handbook', icon: LifeBuoy },
      { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
    ],
  },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The middleware already gates /admin; this is the defence-in-depth check
  // that also protects direct server-component rendering.
  const user = await currentUser();
  if (!user) redirect('/login?callbackUrl=/admin');
  if (!user.isAdmin) redirect('/');

  return (
    // The admin console always renders dark — this aesthetic has no light
    // variant, so there's no ThemeToggle here (unlike the public site).
    <div className="admin-console dark flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap"
      />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-white/10 dark:bg-black">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-white/10">
          <span className="glow-ring flex size-9 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-950/50 dark:border-brand-500/20 dark:bg-brand-950/50">
            <Logo className="size-5" />
          </span>
          <span className="font-bold tracking-tight">Freelee</span>
          <span className="ml-auto rounded-full border border-brand-500/20 bg-brand-950/40 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-brand-400 dark:border-brand-500/30 dark:bg-brand-500/10">
            admin
          </span>
        </div>

        <nav className="flex h-[calc(100%-4rem)] flex-col gap-1 overflow-y-auto p-3 text-sm">
          {SECTIONS.map((section) => (
            <div key={section.heading ?? 'root'}>
              {section.heading ? (
                <p className="mt-4 px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {section.heading}
                </p>
              ) : null}

              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}

          <div className="mt-auto space-y-1 border-t border-slate-200 pt-3 dark:border-white/10">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
            >
              <ExternalLink className="size-4" /> View site
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </aside>

      <div className="flex w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-black/60 dark:backdrop-blur-md">
          <Link href="/admin" className="font-semibold lg:hidden">
            Freelee admin
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm font-medium sm:block">{user.name}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
