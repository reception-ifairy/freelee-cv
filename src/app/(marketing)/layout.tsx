import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { AssistantMount } from '@/components/site/assistant-mount';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter />
      {/* Every public page — the frontpage, personas, pricing, the blog and any
          CMS page. /chat, /embed and /admin are outside this layout and get
          nothing, which is right: a support bubble inside a chat is absurd. */}
      <AssistantMount />
    </>
  );
}
