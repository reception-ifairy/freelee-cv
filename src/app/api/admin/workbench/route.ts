import { streamText, convertToModelMessages, stepCountIs, tool, type ModelMessage, type UIMessage, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationMessages } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getProviderRegistry, getModel, resolveProviderKeys } from '@/lib/ai/registry';
import { agentContext, categoryAgentModel, readThread, recordUsage, updateThread } from '@/lib/taxonomy/category-agent';
import { checkProposal, proposeInputSchema, type Proposal } from '@/lib/taxonomy/agent-proposals';
import type { AgentUsage } from '@/lib/taxonomy/agent-pricing';

/**
 * The category agent's streaming endpoint (owner, 2026-11-16: "each main
 * category is managed by an Anthropic AI agent that helps me build bots").
 *
 * Separate from `/api/chat` on purpose:
 * - **Nobody is billed in credits.** It runs on the owner's own Anthropic key;
 *   the cost is shown on screen instead (agent-pricing.ts).
 * - **`requireAdmin`, not `assertChatAccess`** — there is no customer here.
 * - **The system prompt is the category**, not a persona: its brief, its bots,
 *   its sectors and gaps (category-agent.ts `agentContext`).
 *
 * The agent has one tool, `propose`. It never writes to the catalogue; a
 * checked proposal lands on the category's list, and the owner approves or
 * rejects it there (decideProposalAction).
 *
 * Always Anthropic, model from the `category_agent_model` setting (default
 * Claude Opus 5.5). That model has thinking always on and rejects sampling
 * parameters (`temperature`) and forced tool choice, so none are sent. The
 * system prompt — the long, stable part — is cached; each reply after the
 * first reads it at a tenth of the price.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  id: z.string().min(1),
  messages: z.array(z.custom<UIMessage>()).min(1),
  categoryId: z.coerce.number().int(),
});

const SYSTEM = `You are the AI agent for one category of Freelee, a marketplace of AI specialists. You help the owner build bots for this category.

Below is everything known about the category: its market and regulation, its risk level, its sectors, the audiences it serves, and the bots already filed here — live and not. Use it. Point out gaps (sectors with no bot, audiences nobody serves, weak or duplicate bots) when they matter to the question.

How to work:
- Ask before assuming. One good question beats three paragraphs of guesswork.
- Argue for a narrow specialist over a broad one. "A marketing bot" helps nobody; "a bot that audits landing pages against the ASA code" is a product.
- Never propose a bot that duplicates one already here; say which existing bot covers it.
- If the field is regulated, say what the bot must refuse to do. If the audience is children, say what that changes about its voice.
- Keep replies short enough to read. This is a working conversation.

Proposals:
- When you and the owner settle on something concrete, call the \`propose\` tool. Kinds: \`bot\` (a full persona; it becomes an inactive draft on approval), \`sector_description\` (a better description for one sector, by its id), \`audiences\` (segment codes to link to this field, with a note).
- You cannot change anything yourself. A proposal only appears on the owner's list; say so plainly, and never claim something was created or saved.
- If the tool returns an error, fix the proposal and call it again once.
- A bot's \`systemPrompt\` is the artefact that matters: second person ("You are …"), 150–400 words, covering the role, what it knows, how it speaks, what it must not do, and what it does with questions outside its remit.`;

function usageOf(u: LanguageModelUsage): AgentUsage {
  const read = u.inputTokenDetails?.cacheReadTokens ?? 0;
  const write = u.inputTokenDetails?.cacheWriteTokens ?? 0;
  const fresh = u.inputTokenDetails?.noCacheTokens ?? Math.max(0, (u.inputTokens ?? 0) - read - write);
  return { inputTokens: fresh, outputTokens: u.outputTokens ?? 0, cacheReadTokens: read, cacheWriteTokens: write };
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return new Response('Bad request', { status: 400 });
  const { id: conversationId, messages: uiMessages, categoryId } = parsed.data;

  const thread = await readThread(conversationId);
  if (!thread || thread.categoryId !== categoryId) return new Response('Not this category’s agent thread', { status: 404 });

  const { modelId, keyReady } = await categoryAgentModel();
  if (!keyReady) {
    return new Response('The category agent runs on Anthropic and there is no Anthropic key yet — add it under Settings → Integrations.', { status: 503 });
  }

  const context = await agentContext(categoryId);
  if (!context) return new Response('Unknown category', { status: 404 });

  const [registry, keys] = await Promise.all([getProviderRegistry(), resolveProviderKeys('anthropic')]);

  // The owner's turn is stored before the model sees it, so a stream that dies
  // mid-answer still leaves the question in the transcript.
  const lastMessage = uiMessages[uiMessages.length - 1];
  const userText = (lastMessage?.parts ?? [])
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${conversationMessages.position}), -1) + 1` })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));
  if (userText && lastMessage?.role === 'user') {
    await db.insert(conversationMessages).values({ conversationId, authorType: 'user', authorId: admin.id, content: userText, position: next });
  }

  const system: ModelMessage = {
    role: 'system',
    content: `${SYSTEM}\n\n---\n\n${context.text}`,
    // Cached: the brief and the bot list are the long, stable part of every request.
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  };

  const propose = tool({
    description:
      'Put a proposal on the owner’s list for this category. Nothing changes until the owner approves it. Returns { ok, proposalId } or { ok: false, error }.',
    inputSchema: proposeInputSchema,
    execute: async (input) => {
      const checked = checkProposal(input, { sectorIds: context.sectorIds, linkedCodes: context.linkedCodes });
      if (!checked.ok) return { ok: false, error: checked.error };
      const proposal: Proposal = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        summary: input.summary.trim(),
        status: 'pending',
        payload: checked.payload,
      };
      await updateThread(conversationId, (s) => ({ ...s, proposals: [...(s.proposals ?? []), proposal] }));
      return { ok: true, proposalId: proposal.id, note: 'On the owner’s list, waiting for approval.' };
    },
  });

  const result = streamText({
    model: getModel(registry, 'anthropic', modelId, keys),
    messages: [system, ...(await convertToModelMessages(uiMessages))],
    tools: { propose },
    // Room to propose, read the result and answer; a proposal loop cannot run away.
    stopWhen: stepCountIs(4),
    maxOutputTokens: 16000,
    onFinish: async ({ text, totalUsage }) => {
      const usage = usageOf(totalUsage);
      await db.insert(conversationMessages).values({
        conversationId,
        authorType: 'system',
        content: text,
        position: next + 1,
        model: modelId,
        aiProvider: 'anthropic',
        inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
        outputTokens: usage.outputTokens,
      });
      await Promise.all([
        recordUsage(conversationId, modelId, usage),
        db
          .update(conversations)
          .set({ messageCount: sql`${conversations.messageCount} + 2`, lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId)),
      ]);
    },
  });

  return result.toUIMessageStreamResponse();
}
