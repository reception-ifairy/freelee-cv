'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTHS = {
  desktop: { label: 'Desktop', width: '100%', icon: Monitor },
  tablet: { label: 'Tablet', width: '820px', icon: Tablet },
  mobile: { label: 'Phone', width: '390px', icon: Smartphone },
} as const;

type Device = keyof typeof WIDTHS;

/**
 * The real page, in an iframe, beside the block list.
 *
 * The builder used to be a list of block names with a "View page" link — you
 * edited blind and then went and looked. This shows the page you are editing
 * while you edit it, at three widths, and reloads whenever a block changes.
 *
 * It loads the genuine route rather than re-rendering blocks in the admin, so
 * there is nothing to keep in sync: what is shown is what a visitor gets, down
 * to the theme and fonts.
 */
export function PagePreview({ src, reloadKey }: { src: string; reloadKey: string }) {
  const [device, setDevice] = useState<Device>('desktop');
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastKey = useRef(reloadKey);

  // A block was added, hidden, reordered or saved — pull the page again.
  useEffect(() => {
    if (lastKey.current === reloadKey) return;
    lastKey.current = reloadKey;
    setLoading(true);
    if (frameRef.current) frameRef.current.src = withPreviewFlag(src);
  }, [reloadKey, src]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <p className="mr-auto text-xs font-bold uppercase tracking-widest text-slate-400">Preview</p>

        {(Object.keys(WIDTHS) as Device[]).map((key) => {
          const { label, icon: Icon } = WIDTHS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-pressed={device === key}
              title={label}
              aria-label={label}
              className={cn(
                'grid size-7 place-items-center rounded-lg transition',
                device === key
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              )}
            >
              <Icon className="size-3.5" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            if (frameRef.current) frameRef.current.src = withPreviewFlag(src);
          }}
          title="Reload the preview"
          aria-label="Reload the preview"
          className="grid size-7 place-items-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </button>

        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          title="Open in a new tab"
          aria-label="Open in a new tab"
          className="grid size-7 place-items-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <iframe
          ref={frameRef}
          src={withPreviewFlag(src)}
          title="Page preview"
          onLoad={() => setLoading(false)}
          className="mx-auto h-full min-h-[36rem] rounded-xl border border-slate-200 bg-white shadow-sm transition-[width] dark:border-slate-700"
          style={{ width: WIDTHS[device].width }}
        />
      </div>
    </div>
  );
}

/**
 * Marks the frame as a preview so the site can suppress the on-page editor
 * chrome inside it — otherwise an admin sees a builder panel within a builder.
 */
function withPreviewFlag(src: string): string {
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}preview=1&t=${Date.now()}`;
}
