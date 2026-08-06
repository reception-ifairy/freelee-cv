import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { themes } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { ThemeForm, DEFAULT_TOKENS } from '@/components/admin/theme-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Appearance' };

export default async function AdminThemePage() {
  const [theme] = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1);


  return (
    <div>
      <PageHeader
        title="Appearance"
        description="Design tokens are injected as CSS variables — no rebuild required."
      />
      <ThemeForm
        tokens={{ ...DEFAULT_TOKENS, ...(theme?.tokens ?? {}) }}
        customCss={theme?.customCss ?? ''}
      />
    </div>
  );
}
