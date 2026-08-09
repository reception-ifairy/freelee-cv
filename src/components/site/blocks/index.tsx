import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Quote } from 'lucide-react';
import { Markdown } from '@/components/site/markdown';
import { BlockIcon } from '@/components/ui/block-icon';
import { COLUMNS_CLASS, type BlockLayout } from '@/lib/blocks/layout';
import { cn } from '@/lib/utils';

/**
 * Blocks added with the builder, as opposed to the eight in `../sections/`
 * that predate it.
 *
 * The difference matters: these render **bare content with no band of their
 * own**, because the layout wrapper supplies width, padding and background.
 * The older sections carry their own `<section className="container-app py-N">`
 * and so are given a no-op default layout instead.
 *
 * Each one takes `(config, layout)` — `layout.columns` is what makes the grid
 * control do something real rather than being decoration.
 */

type Config = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const list = (v: unknown): Config[] => (Array.isArray(v) ? (v as Config[]) : []);

function Heading({ title, subtitle }: { title: unknown; subtitle: unknown }) {
  if (!str(title) && !str(subtitle)) return null;
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {str(title) ? <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{str(title)}</h2> : null}
      {str(subtitle) ? <p className="mt-3 text-slate-500 dark:text-slate-400">{str(subtitle)}</p> : null}
    </div>
  );
}

function Cta({ label, href }: { label: unknown; href: unknown }) {
  if (!str(label) || !str(href)) return null;
  return (
    <Link
      href={str(href)}
      className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      {str(label)}
      <ArrowRight className="size-4" />
    </Link>
  );
}

export function FeaturesGridBlock({ config, layout }: { config: Config; layout: BlockLayout }) {
  const items = list(config.items);
  if (items.length === 0) return null;

  return (
    <>
      <Heading title={config.title} subtitle={config.subtitle} />
      <div className={cn('grid gap-8', COLUMNS_CLASS[layout.columns])}>
        {items.map((item, i) => (
          <div key={i}>
            <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <BlockIcon name={item.icon} className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{str(item.title)}</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{str(item.body)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function StatsBlock({ config, layout }: { config: Config; layout: BlockLayout }) {
  const items = list(config.items);
  if (items.length === 0) return null;

  return (
    <>
      <Heading title={config.title} subtitle={config.subtitle} />
      <div className={cn('grid gap-8 text-center', COLUMNS_CLASS[layout.columns])}>
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-3xl font-bold tracking-tight text-brand-600 dark:text-brand-400 sm:text-4xl">{str(item.value)}</p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{str(item.label)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Accordion built on native `<details>`/`<summary>` — it opens, closes and is
 * keyboard- and screen-reader-accessible with no JavaScript at all, which a
 * hand-rolled version would have to re-earn.
 */
export function FaqBlock({ config }: { config: Config }) {
  const items = list(config.items);
  if (items.length === 0) return null;

  return (
    <>
      <Heading title={config.title} subtitle={config.subtitle} />
      <div className="mx-auto max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((item, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
              {str(item.question)}
              <span className="shrink-0 text-slate-400 transition group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              <Markdown>{str(item.answer)}</Markdown>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

export function TestimonialsBlock({ config, layout }: { config: Config; layout: BlockLayout }) {
  const items = list(config.items);
  if (items.length === 0) return null;

  return (
    <>
      <Heading title={config.title} subtitle={config.subtitle} />
      <div className={cn('grid gap-6', COLUMNS_CLASS[layout.columns])}>
        {items.map((item, i) => (
          <figure key={i} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
            <Quote className="size-5 text-brand-400" />
            <blockquote className="mt-3 text-sm text-slate-600 dark:text-slate-300">{str(item.quote)}</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {str(item.avatar) ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, same convention as persona avatars
                <img src={str(item.avatar)} alt="" className="size-9 rounded-full object-cover" />
              ) : null}
              <span>
                <span className="block text-sm font-semibold">{str(item.name)}</span>
                {str(item.role) ? <span className="block text-xs text-slate-400">{str(item.role)}</span> : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

export function LogosBlock({ config }: { config: Config }) {
  const items = list(config.items);
  if (items.length === 0) return null;

  return (
    <>
      {str(config.title) ? (
        <p className="mb-6 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{str(config.title)}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {items.map((item, i) => {
          // Greyscale by default so a wall of mismatched brand colours doesn't
          // fight the page; colour returns on hover.
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL
            <img
              src={str(item.imageUrl)}
              alt={str(item.name)}
              className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
            />
          );
          return str(item.href) ? (
            <Link key={i} href={str(item.href)}>
              {img}
            </Link>
          ) : (
            <span key={i}>{img}</span>
          );
        })}
      </div>
    </>
  );
}

export function ImageTextBlock({ config }: { config: Config }) {
  const image = str(config.imageUrl);
  const imageFirst = config.imagePosition === 'left';

  const text = (
    <div>
      {str(config.heading) ? <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{str(config.heading)}</h2> : null}
      <Markdown className="mt-4 text-slate-600 dark:text-slate-300">{str(config.body)}</Markdown>
      <Cta label={config.ctaLabel} href={config.ctaHref} />
    </div>
  );

  if (!image) return <div className="mx-auto max-w-2xl">{text}</div>;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      {imageFirst ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL */}
          <img src={image} alt="" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800" />
          {text}
        </>
      ) : (
        <>
          {text}
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL */}
          <img src={image} alt="" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800" />
        </>
      )}
    </div>
  );
}

/**
 * Turns a YouTube/Vimeo page URL into its embed URL.
 *
 * Allow-listed rather than passed through: this string becomes an `<iframe
 * src>`, so accepting an arbitrary URL would let anyone with admin access embed
 * anything at all — including a `javascript:` URL on an older browser. Anything
 * unrecognised renders nothing rather than a broken frame.
 */
export function embedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.searchParams.get('v');
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export function VideoBlock({ config }: { config: Config }) {
  const src = embedUrl(str(config.url));
  if (!src) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <Heading title={config.title} subtitle={config.subtitle} />
      <div className="aspect-video overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <iframe
          src={src}
          title={str(config.title) || 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="size-full"
        />
      </div>
      {str(config.caption) ? <p className="mt-3 text-center text-xs text-slate-400">{str(config.caption)}</p> : null}
    </div>
  );
}

const SPACER_HEIGHT: Record<string, string> = { sm: 'h-6', md: 'h-14', lg: 'h-24' };

export function SpacerBlock({ config }: { config: Config }) {
  const height = SPACER_HEIGHT[str(config.height)] ?? SPACER_HEIGHT.md;
  return (
    <div className={height} aria-hidden>
      {config.divider ? <hr className="mt-[calc(50%-0.5px)] border-slate-200 dark:border-slate-800" /> : null}
    </div>
  );
}

/** The one container block. Children are rendered by the caller and passed in — nesting is capped at one level. */
export function ColumnsBlock({ layout, children }: { layout: BlockLayout; children: ReactNode }) {
  return <div className={cn('grid gap-8', COLUMNS_CLASS[layout.columns])}>{children}</div>;
}
