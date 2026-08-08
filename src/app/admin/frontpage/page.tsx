import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus } from 'lucide-react';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SECTION_LABELS, CONFIGURABLE_SECTION_TYPES, isCoreSectionType } from '@/components/site/sections';
import type { SectionType } from '@/components/site/sections';
import {
  DEFAULT_HERO_CONFIG, DEFAULT_CTA_CONFIG, DEFAULT_HOW_IT_WORKS_CONFIG, DEFAULT_CUSTOM_CONTENT_CONFIG,
} from '@/components/site/sections/types';
import type { HeroConfig, CtaConfig, HowItWorksConfig, CustomContentConfig } from '@/components/site/sections/types';
import { toggleSectionAction, moveSectionAction, createCustomSectionAction, deleteCustomSectionAction } from '@/server/actions/admin-frontpage';
import { HeroForm, CtaForm, HowItWorksForm, CustomContentForm } from './frontpage-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Frontpage' };

function ConfigEditor({ type, id, config }: { type: string; id: number; config: unknown }) {
  switch (type) {
    case 'hero':
      return <HeroForm id={id} config={{ ...DEFAULT_HERO_CONFIG, ...(config as Partial<HeroConfig>) }} />;
    case 'cta':
      return <CtaForm id={id} config={{ ...DEFAULT_CTA_CONFIG, ...(config as Partial<CtaConfig>) }} />;
    case 'how_it_works':
      return <HowItWorksForm id={id} config={{ ...DEFAULT_HOW_IT_WORKS_CONFIG, ...(config as Partial<HowItWorksConfig>) }} />;
    case 'custom_content':
      return <CustomContentForm id={id} config={{ ...DEFAULT_CUSTOM_CONTENT_CONFIG, ...(config as Partial<CustomContentConfig>) }} />;
    default:
      return null;
  }
}

export default async function FrontpagePage() {
  const sections = await db.select().from(pageSections).where(eq(pageSections.page, 'home')).orderBy(asc(pageSections.position));

  return (
    <div>
      <PageHeader
        title="Frontpage"
        description="Reorder, hide, or edit the home page's sections. Changes appear on the live site immediately. See docs/19-frontpage-sections.md."
        actions={
          <form action={createCustomSectionAction}>
            <button type="submit" className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700">
              <Plus className="size-3.5" /> Add custom section
            </button>
          </form>
        }
      />

      <div className="space-y-4">
        {sections.map((section, i) => {
          const isCore = isCoreSectionType(section.type);
          const configurable = CONFIGURABLE_SECTION_TYPES.has(section.type as SectionType);

          return (
            <Card key={section.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{SECTION_LABELS[section.type as keyof typeof SECTION_LABELS] ?? section.type}</p>
                    <Badge tone={isCore ? 'slate' : 'brand'}>{isCore ? 'core' : 'custom'}</Badge>
                    <Badge tone={section.isVisible ? 'green' : 'slate'}>{section.isVisible ? 'visible' : 'hidden'}</Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <form action={moveSectionAction}>
                      <input type="hidden" name="id" value={section.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={i === 0}
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                    </form>
                    <form action={moveSectionAction}>
                      <input type="hidden" name="id" value={section.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={i === sections.length - 1}
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </form>
                    <form action={toggleSectionAction}>
                      <input type="hidden" name="id" value={section.id} />
                      <input type="hidden" name="isVisible" value={String(section.isVisible)} />
                      <button
                        type="submit"
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        aria-label={section.isVisible ? 'Hide' : 'Show'}
                      >
                        {section.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                    </form>
                    {section.type === 'custom_content' ? (
                      <form action={deleteCustomSectionAction}>
                        <input type="hidden" name="id" value={section.id} />
                        <button type="submit" className="ml-1 text-xs font-medium text-rose-500 hover:underline">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                {configurable ? (
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                    <ConfigEditor type={section.type} id={section.id} config={section.config} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Pulled live from existing data — nothing to edit here, only reorder or hide.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
