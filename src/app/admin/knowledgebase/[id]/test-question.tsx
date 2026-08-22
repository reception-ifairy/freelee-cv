'use client';

import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Hint } from '@/components/ui/field';
import { testQuestionAction, type TestResult } from '@/server/actions/admin-knowledgebase';

/**
 * Ask a question, see what comes back.
 *
 * The one control that makes retrieval legible. Everything else in this panel
 * *describes* the pipeline; this shows its output — the exact passages a bot
 * would be handed for a given question, in the order it would get them. It is
 * also the honest way to notice that a book was processed badly, that a shelf
 * is missing, or that the library simply does not contain the answer.
 *
 * Returning nothing is a real, useful result and is shown as one. Vector
 * search has no idea of "no match" and will always hand back its nearest
 * guess, so a relevance floor is applied before the results get here — without
 * it a question the library cannot answer comes back with a confidently
 * irrelevant passage, which is worse than silence.
 */
export function TestQuestion({ collectionKeys, title }: { collectionKeys: string[]; title: string }) {
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card padding="md">
      <p className="eyebrow mb-1">Try it</p>
      <Hint>
        Ask something you know is in “{title}”. You will see the passages a bot would be given — the same
        ones, in the same order.
      </Hint>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setError(null);
            const result = await testQuestionAction(collectionKeys, question);
            setError(result.error ?? null);
            setResults(result.results ?? null);
          });
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does this book say about…?"
          className="flex-1"
        />
        <Button type="submit" loading={pending} disabled={question.trim().length < 3}>
          <Search className="size-4" /> Ask
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      {results && results.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Nothing came back — the library has no passage close enough to that question. That is a real
          answer, not a failure: a bot would say it does not know rather than quote something irrelevant.
        </p>
      ) : null}

      {results && results.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {results.map((hit, index) => (
            <li key={index} className="rounded-card border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-xs text-slate-400">{index + 1}</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{hit.citation}</span>
              </p>
              <p className="text-sm">{hit.text.length > 700 ? `${hit.text.slice(0, 700)}…` : hit.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
