'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { UIMessage } from 'ai';
import { Bot, Check, ExternalLink, KeyRound, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint, Select } from '@/components/ui/field';
import { Disclosure } from '@/components/ui/disclosure';
import { ChatWindow } from '@/components/chat/chat-window';
import { AUDIENCE_SEGMENTS } from '@/lib/persona/audience-segments';
import { AGENT_MODELS, formatUsd } from '@/lib/taxonomy/agent-pricing';
import type { AgentThreadState } from '@/lib/taxonomy/category-agent';
import type { Proposal } from '@/lib/taxonomy/agent-proposals';
import {
  agentStateAction,
  buildDraftFromWorkbenchAction,
  decideProposalAction,
  openWorkbenchAction,
  workbenchHistoryAction,
} from '@/server/actions/admin-taxonomy';

/**
 * A category's AI agent (owner, 2026-11-16): an Anthropic model that knows the
 * field — its brief, its bots, its sectors and gaps — and helps design bots.
 * It proposes; the owner approves. Each proposal shows here with Approve and
 * Reject; approving runs the ordinary admin change (a new bot is always an
 * inactive draft). The model and what the conversation has cost are always on
 * screen: it is paid from the owner's own Anthropic key.
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<AgentThreadState | null>(null);
  const [opening, startOpening] = useTransition();

  const refresh = useCallback(async (id: string) => {
    const next = await agentStateAction(id);
    if (!('error' in next)) setState(next);
  }, []);

  // Opened on first use: twenty categories should not mean twenty empty threads.
  const open = () =>
    startOpening(async () => {
      const result = await openWorkbenchAction(categoryId);
      if ('error' in result) {
        setNoKey(Boolean(result.noKey));
        setMessage(result.noKey ? null : result.error);
        return;
      }
      const history = await workbenchHistoryAction(result.conversationId);
      setInitial(
        history.map((row, index) => ({
          id: String(row.id),
          role: row.authorType === 'user' ? ('user' as const) : ('assistant' as const),
          parts: [{ type: 'text' as const, text: row.content }],
          metadata: { index },
        })),
      );
      setModel(result.model);
      setConversationId(result.conversationId);
      await refresh(result.conversationId);
    });

  useEffect(() => {
    setConversationId(null);
    setInitial([]);
    setState(null);
    setMessage(null);
    setNoKey(false);
  }, [categoryId]);

  if (!conversationId) {
    return (
      <Card padding="md">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 size-5 shrink-0 text-lime-500" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">The AI agent for {categoryName}</p>
            <Hint>
              It knows this field — the market, its regulation and risk, its sectors, the audiences it serves and every bot
              already filed here — and helps you design new ones. It proposes; you approve. It runs on Anthropic from your own
              key, so every reply costs money, shown as you go.
            </Hint>
          </div>
          <Button onClick={open} loading={opening}>
            <Sparkles className="size-4" /> Open the agent
          </Button>
        </div>
        {noKey ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <KeyRound className="size-4" />
            The agent runs on Anthropic and there is no Anthropic key yet.
            <Link href="/admin/connections#conn-anthropic" className="font-semibold underline">
              Add it in Connections
            </Link>
            , press Test, then open the agent again.
          </p>
        ) : null}
        {message ? <p className="mt-2 text-sm text-rose-400">{message}</p> : null}
      </Card>
    );
  }

  const pending = state?.proposals.filter((p) => p.status === 'pending') ?? [];
  const decided = state?.proposals.filter((p) => p.status !== 'pending') ?? [];

  return (
    <div className="space-y-4">
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <Bot className="size-4 text-lime-500" />
          <p className="text-sm font-medium">AI agent — {categoryName}</p>
          {model ? <span className="text-xs text-slate-500">{model}</span> : null}
          <span className="ms-auto font-mono text-[11px] text-slate-500" title="Estimated from the tokens used, at Anthropic's list prices">
            {state ? `this conversation: ${state.usd === null ? 'cost unknown for this model' : formatUsd(state.usd)}` : ''}
            {state && AGENT_MODELS[state.modelId] ? ` · $${AGENT_MODELS[state.modelId].input} / $${AGENT_MODELS[state.modelId].output} per M tokens` : ''}
          </span>
        </div>
        <div className="[&>section]:h-[34rem]">
          <ChatWindow
            chatId={conversationId}
            apiPath="/api/admin/workbench"
            apiBody={{ categoryId }}
            initialMessages={initial}
            onFinish={() => void refresh(conversationId)}
            suggestions={[
              `Which bots are missing in ${categoryName}?`,
              'Which sectors have no bot, and which would sell first?',
              'Review the bots that are not live: keep, fix or drop?',
              'Propose the bot we just discussed.',
            ]}
            personaName="the agent"
            layoutKey="professional"
            capabilities={{ copy: true, suggestions: true }}
          />
        </div>
      </Card>

      <section>
        <h3 className="eyebrow mb-2">Proposals waiting for you · {pending.length}</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            None. When you settle on something with the agent, ask it to propose it — it appears here, and nothing changes until
            you approve.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <ProposalCard key={p.id} proposal={p} sectors={sectors} conversationId={conversationId} onDone={() => refresh(conversationId)} />
            ))}
          </ul>
        )}
        {decided.length ? (
          <div className="mt-3 rounded-card border border-slate-200 px-2 dark:border-white/10">
            <Disclosure title="Decided" meta={<span className="font-mono">{decided.length}</span>}>
              <ul className="space-y-1 pb-2 pl-8 text-sm">
                {[...decided].reverse().map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.status === 'approved' ? 'green' : 'slate'}>{p.status}</Badge>
                    <span className="text-slate-400">{p.summary}</span>
                    {p.personaId ? (
                      <Link href={`/admin/personas/${p.personaId}`} className="text-xs font-semibold text-brand-400 hover:underline">
                        Open the draft
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        ) : null}
      </section>

      <PasteDraft categoryId={categoryId} categoryName={categoryName} sectors={sectors} />
    </div>
  );
}

const KIND_LABEL: Record<Proposal['payload']['kind'], string> = {
  bot: 'New bot',
  sector_description: 'Sector description',
  audiences: 'Audience groups',
};

function ProposalCard({
  proposal,
  sectors,
  conversationId,
  onDone,
}: {
  proposal: Proposal;
  sectors: { id: number; name: string }[];
  conversationId: string;
  onDone: () => void;
}) {
  const [busy, startBusy] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const sectorName = (id: number | null) => (id === null ? 'no sector' : sectors.find((s) => s.id === id)?.name ?? `sector ${id}`);
  const p = proposal.payload;

  const act = (decision: 'approved' | 'rejected') =>
    startBusy(async () => {
      const r = await decideProposalAction(conversationId, proposal.id, decision);
      setResult(r?.error ?? r?.success ?? null);
      onDone();
    });

  return (
    <li className="rounded-card border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-start gap-2">
        <Badge tone="brand">{KIND_LABEL[p.kind]}</Badge>
        <p className="min-w-0 flex-1 text-sm font-medium">{proposal.summary}</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" loading={busy} onClick={() => act('approved')}>
            <Check className="size-3.5" /> Approve
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act('rejected')}>
            <X className="size-3.5" /> Reject
          </Button>
        </div>
      </div>

      <div className="mt-2 text-sm text-slate-400">
        {p.kind === 'bot' ? (
          <>
            <p>
              <strong className="text-slate-200">{p.persona.name}</strong>
              {p.persona.tagline ? ` — ${p.persona.tagline}` : ''} · {p.persona.audienceType ?? 'audience type from the field'} ·{' '}
              {sectorName(p.sectorId)}
            </p>
            <Disclosure title="System prompt and details" className="mt-1">
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-xs text-slate-300">{p.persona.systemPrompt}</pre>
              {p.persona.description ? <p className="mt-2 text-xs">{p.persona.description}</p> : null}
            </Disclosure>
            <p className="mt-1 text-xs">Approving saves it as an inactive draft in this category; you review and publish it in the editor.</p>
          </>
        ) : p.kind === 'sector_description' ? (
          <p>
            <strong className="text-slate-200">{sectorName(p.sectorId)}:</strong> {p.description}
          </p>
        ) : (
          <p>
            Link {p.codes.map((c) => AUDIENCE_SEGMENTS[c]?.name ?? c).join(', ')}
            {p.note ? ` — ${p.note}` : ''}
          </p>
        )}
      </div>
      {result ? <p className="mt-2 text-xs text-slate-300">{result}</p> : null}
    </li>
  );
}

/** The old path, kept: paste a persona written out as JSON, and save it as an inactive draft. */
function PasteDraft({ categoryId, categoryName, sectors }: { categoryId: number; categoryName: string; sectors: { id: number; name: string }[] }) {
  const [json, setJson] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-card border border-slate-200 px-2 dark:border-white/10">
      <Disclosure title="Paste a persona by hand">
        <div className="space-y-2 px-2 pb-3">
          <Hint>Paste a persona written out as JSON; it becomes an inactive draft filed under {categoryName}.</Hint>
          <Select value={sectorId} onChange={(e) => setSectorId(e.target.value)} aria-label="Specialism" className="text-xs">
            <option value="">No specialism</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder='{ "name": "…", "systemPrompt": "…" }'
            className="w-full rounded-control border border-slate-200 bg-transparent p-2 font-mono text-xs dark:border-slate-700"
          />
          <Button
            disabled={json.trim().length < 20}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const formData = new FormData();
                formData.set('categoryId', String(categoryId));
                if (sectorId) formData.set('sectorId', sectorId);
                formData.set('persona', json.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
                const result = await buildDraftFromWorkbenchAction(formData);
                setMessage(result?.success ?? result?.error ?? null);
                if (result?.personaId) {
                  setJson('');
                  setPersonaId(result.personaId);
                }
              })
            }
          >
            Save as a draft
          </Button>
          {message ? (
            <p className="text-sm">
              {message}{' '}
              {personaId ? (
                <Link href={`/admin/personas/${personaId}`} className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:underline">
                  Open it <ExternalLink className="size-3" />
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </Disclosure>
    </div>
  );
}
