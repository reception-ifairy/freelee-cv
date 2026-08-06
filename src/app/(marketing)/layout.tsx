import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter />
    </>
  );
}
