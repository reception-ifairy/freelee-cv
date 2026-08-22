import { FileDown, Type, Scissors, Binary } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { humanBytes } from '../status';

/**
 * The four stages, named the way you would explain them out loud.
 *
 * "Embedding" is jargon and the person running this site said plainly they
 * have not done it before. So no stage is called what the industry calls it —
 * each one says what happened and shows the number that proves it. A stage
 * that has not run yet is dimmed rather than hidden, because seeing what is
 * *about* to happen is most of what makes a pipeline understandable.
 */
export function Pipeline({
  status, bytes, pages, textChars, passageCount, embeddingModel,
}: {
  status: string;
  bytes: number;
  pages: number | null;
  textChars: number;
  passageCount: number;
  embeddingModel: string | null;
}) {
  const stopped = status === 'failed' || status === 'needs_ocr';

  const stages = [
    {
      icon: FileDown,
      title: 'Read the file',
      done: true,
      detail: `${humanBytes(bytes)}${pages ? ` · ${pages} pages` : ''}`,
    },
    {
      icon: Type,
      title: 'Pulled the text out',
      done: textChars > 0,
      detail: textChars > 0
        ? `${textChars.toLocaleString()} characters of readable text`
        : stopped ? 'stopped here' : 'not yet',
    },
    {
      icon: Scissors,
      title: 'Cut it into passages',
      done: passageCount > 0,
      detail: passageCount > 0
        ? `${passageCount} passages, each a few paragraphs long`
        : 'not yet',
    },
    {
      icon: Binary,
      title: 'Made the passages searchable',
      done: Boolean(embeddingModel),
      detail: embeddingModel
        ? `each passage turned into 1,536 numbers by ${embeddingModel}, so a bot can find it by meaning rather than by exact words`
        : 'not yet',
    },
  ];

  return (
    <Card padding="md">
      <p className="eyebrow mb-4">What happened to this document</p>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <li key={stage.title} className={stage.done ? '' : 'opacity-45'}>
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums dark:bg-slate-800">
                {index + 1}
              </span>
              <stage.icon className="size-4 text-slate-400" />
              <span className="text-sm font-medium">{stage.title}</span>
            </div>
            <p className="mt-1.5 ps-9 text-xs text-slate-500 dark:text-slate-400">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
