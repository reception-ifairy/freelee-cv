import { SiteHeader } from '@/components/site/header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh]">{children}</main>
    </>
  );
}
