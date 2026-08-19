'use client';

import { MessageSquare } from 'lucide-react';
import { MessageBubble } from '@/components/chat/message-bubble';
import { resolveChatLayout } from '@/lib/chat/layouts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export type TranscriptMessage = {
  id: string;
  authorType: string;
  content: string;
  error: string | null;
  speaker: string;
};

/**
 * What the personas actually said.
 *
 * Reuses `MessageBubble` unchanged. It already takes a `speaker` prop and the
 * `flat` bubble style already renders it — that pair is exactly the seam a
 * multi-persona transcript needs, and it has existed since the chat-layouts
 * work without an admin surface to use it.
 *
 * The point of reusing it rather than writing an admin renderer: this transcript
 * then *is* the product's chat, so markdown, guardrail callouts and narrative
 * layouts all behave identically here. A second renderer would drift within a
 * release.
 *
 * `roundtable` is the group layout — flat rows with speaker labels, which is
 * what a many-personas transcript wants. `layoutsForSurface('group')` is where
 * that set is defined.
 */
export function RunTranscript({ messages }: { messages: TranscriptMessage[] }) {
  const layout = resolveChatLayout('roundtable');

  return (
    <Card padding="md" className="flex max-h-[42rem] flex-col">
      <h2 className="font-semibold">Transcript</h2>
      <p className="mt-1 text-xs text-slate-500">The conversation the team produced, as the product renders it.</p>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nothing said yet"
          description="Replies appear here as each member takes its turn."
          className="mt-4 border-0 py-8"
        />
      ) : (
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id}>
              <MessageBubble
                role={message.authorType === 'user' ? 'user' : 'assistant'}
                // An empty reply is not the same as no reply. The model
                // genuinely returned nothing and the row was saved complete —
                // saying so beats rendering a blank bubble that looks broken.
                text={message.content || '_(the model returned an empty reply)_'}
                speaker={message.speaker}
                layout={layout}
                canCopy
              />
              {message.error ? (
                <p className="mt-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-400">{message.error}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
