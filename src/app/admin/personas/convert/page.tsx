import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { BotConverter } from '@/components/admin/bot-converter';

/**
 * Admin only, and only from here — there is no public route, no API endpoint
 * and no team-facing surface. See docs/42-bot-converter.md.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Convert a bot' };

export default function ConvertBotPage() {
  return (
    <>
      <PageHeader
        title="Bot converter"
        description="Turn a character brief, a legacy config sheet or an old bot's guidelines into a draft persona."
        actions={
          <Link
            href="/admin/personas"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-white/10"
          >
            <ArrowLeft className="size-4" /> Personas
          </Link>
        }
      />
      <BotConverter />
    </>
  );
}
