import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * react-markdown escapes raw HTML by default, so untrusted content (blog
 * posts, AI output) cannot inject markup.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose prose-slate max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
