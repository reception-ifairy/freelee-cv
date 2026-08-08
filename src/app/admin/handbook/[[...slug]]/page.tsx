import type { Metadata } from 'next';
import Link from 'next/link';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Markdown } from '@/components/site/markdown';
import { HANDBOOK, HANDBOOK_PAGES, findPage, neighbours, partOf } from '@/lib/handbook/toc';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const HANDBOOK_DIR = path.join(process.cwd(), 'handbook');

type Params = Promise<{ slug?: string[] }>;

async function resolveSlug(params: Params): Promise<string> {
  const { slug } = await params;
  return slug?.[0] ?? HANDBOOK_PAGES[0].slug;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = findPage(await resolveSlug(params));
  return { title: page ? `${page.title} — Handbook` : 'Handbook' };
}

export default async function HandbookPage({ params }: { params: Params }) {
  const slug = await resolveSlug(params);
  const page = findPage(slug);
  if (!page) notFound();

  let content: string;
  try {
    content = await fs.readFile(path.join(HANDBOOK_DIR, `${slug}.md`), 'utf-8');
  } catch {
    // A page listed in the TOC with no file yet says so plainly rather than
    // 404ing — the TOC is the plan, and a gap in it is information.
    content = `# ${page.title}\n\n_This page has not been written yet._`;
  }

  const { prev, next } = neighbours(slug);
  const part = partOf(slug);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Handbook</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How everything in this admin panel works, in plain language.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-2">
            {HANDBOOK.map((section) => (
              <div key={section.title}>
                <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.pages.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/admin/handbook/${item.slug}`}
                        className={cn(
                          'block rounded-lg px-2.5 py-1.5 text-sm transition',
                          item.slug === slug
                            ? 'bg-brand-500/10 font-semibold text-brand-300'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <article className="min-w-0">
          {part ? (
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-brand-400">
              {part.title}
            </p>
          ) : null}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
            <Markdown>{content}</Markdown>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/admin/handbook/${prev.slug}`}
                className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-400 dark:border-white/10"
              >
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ArrowLeft className="size-3.5" /> Previous
                </p>
                <p className="mt-1 font-semibold group-hover:text-brand-400">{prev.title}</p>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/admin/handbook/${next.slug}`}
                className="group rounded-xl border border-slate-200 p-4 text-right transition hover:border-brand-400 dark:border-white/10"
              >
                <p className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                  Next <ArrowRight className="size-3.5" />
                </p>
                <p className="mt-1 font-semibold group-hover:text-brand-400">{next.title}</p>
              </Link>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
