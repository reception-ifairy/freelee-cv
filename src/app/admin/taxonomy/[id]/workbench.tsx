'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { UIMessage } from 'ai';
import { FlaskConical, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, Hint } from '@/components/ui/field';
import { ChatWindow } from '@/components/chat/chat-window';
import {
  openWorkbenchAction,
  workbenchHistoryAction,
  buildDraftFromWorkbenchAction,
} from '@/server/actions/admin-taxonomy';

/**
 * Where new bots get designed.
 *
 * The conversation runs against the *category brief* rather than a persona —
 * the market, the regulation, the risk level, the specialisms and the audiences,
 * all of which existed as researched data and reached nothing until now.
 *
 * It reuses the product's own chat window (composer, bubbles, layouts) with the
 * transport pointed elsewhere. The capabilities that assume a customer chat row
 * — image generation, speech, transcription, sharing — are off, because each one
 * calls `assertChatAccess` and there is no `chats` row here on purpose.
 */
export function Workbench({
  categoryId,
  categoryName,
  sectors,
}: {
  categoryId: number;
  categoryName: string;
  sectors: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [sectorId, setSectorId] = useState<string>('');
  const [json, setJson] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [pending, startTransition] = useTransition();

  // The conversation is opened lazily, on first use — the same shape the site
  // assistant uses. Twenty categories should not mean twenty empty rows.
  const open = () => {
    setOpening(true);
    startTransition(async () => {
      const result = await openWorkbenchAction(categoryId);
      if ('error' in result) {
        setMessage(result.error);
        setOpening(false);
        return;
      }
      const history = await workbenchHistoryAction(result.conversationId);
      setInitial(
        history.map((row, index) => ({
          id: String(row.id),
          role: row.authorType === 'user' ? ('user' as const) : ('assistant' as const),
          parts: [{ type: 'text' as const, text: row.content }],
          // Position is already the sort order; index keeps React keys stable.
          metadata: { index },
        })),
      );
      setConversationId(result.conversationId);
      setOpening(false);
    });
  };

  useEffect(() => {
    // Reopening on navigation would fight the lazy open above, so this only
    // clears state when the category changes underneath the component.
    setConversationId(null);
    setInitial([]);
    setJson('');
    setMessage(null);
  }, [categoryId]);

  if (!conversationId) {
    return (
      <Card padding="md">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-lime-500" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Design a specialist for this field</p>
            <Hint>
              A working conversation with everything known about {categoryName} already in front of
              it — the market, the regulations, the risk level, the specialisms and the audiences.
              Nothing here is charged, and nothing goes live until you publish it.
            </Hint>
          </div>
          <Button onClick={open} loading={opening || pending}>
            <Sparkles className="size-4" /> Open workbench
          </Button>
        </div>
        {message ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{message}</p> : null}
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <FlaskConical className="size-4 text-lime-500" />
        <p className="text-sm font-medium">Workbench — {categoryName}</p>
        <div className="ms-auto flex items-center gap-2">
          <Select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            aria-label="Specialism for the prototype"
            className="text-xs"
          >
            <option value="">No specialism</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="[&>section]:h-[36rem]">
        <ChatWindow
          chatId={conversationId}
          apiPath="/api/admin/workbench"
          apiBody={{ categoryId }}
          initialMessages={initial}
          suggestions={[
            `What kind of specialist is missing in ${categoryName}?`,
            'Who exactly would pay for this, and what would they ask it first?',
            'What must this bot refuse to do?',
            'Write the persona out as JSON.',
          ]}
          personaName="the architect"
          layoutKey="professional"
          capabilities={{ copy: true, suggestions: true }}
        />
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-700">
        <p className="eyebrow mb-2">Save as a prototype</p>
        <Hint>
          Ask the architect to write the persona out, then paste the JSON block here. It becomes a
          draft filed under {categoryName} — inactive, with its audience and safeguards already set.
        </Hint>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder='{ "name": "…", "systemPrompt": "…" }'
          className="mt-2 w-full rounded-control border border-slate-200 bg-transparent p-2 font-mono text-xs dark:border-slate-700"
        />
        <Button
          className="mt-2"
          disabled={json.trim().length < 20}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set('categoryId', String(categoryId));
              if (sectorId) formData.set('sectorId', sectorId);
              // The fence is stripped here so pasting the whole block works —
              // asking a person to trim markdown is asking for a bug report.
              formData.set('persona', json.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
              const result = await buildDraftFromWorkbenchAction(formData);
              setMessage(result?.success ?? result?.error ?? null);
              if (result?.personaId) {
                setJson('');
                router.push(`/admin/personas/${result.personaId}`);
              }
            })
          }
        >
          Save as prototype
        </Button>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </div>
    </Card>
  );
}
