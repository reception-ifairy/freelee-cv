import { streamText, convertToModelMessages, stepCountIs, tool, type SystemModelMessage, type UIMessage, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationMessages } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getProviderRegistry, getModel, resolveProviderKeys } from '@/lib/ai/registry';
import { agentContext, categoryAgentModel, readThread, recordUsage, updateThread } from '@/lib/taxonomy/category-agent';
import { checkProposal, proposeInputSchema, type Proposal } from '@/lib/taxonomy/agent-proposals';
import { checkPlan, planForModel, planInputSchema, updatePlanItem } from '@/lib/taxonomy/agent-plan';
import { readBot, scanAudiences, scanCategory } from '@/lib/taxonomy/agent-scan';
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
 * Its tools (2026-11-16, second pass: "scan the audiences and the category,
 * then help me one by one with the first drafts"):
 * - `scan_category`, `scan_audiences`, `read_bot` — read-only (agent-scan.ts);
 * - `save_plan` — the ordered plan of the first bots, a working list in the
 *   thread (agent-plan.ts), not a catalogue change;
 * - `propose` — never writes to the catalogue; a checked proposal lands on the
 *   category's list, and the owner approves or rejects it there
 *   (decideProposalAction).
 *
 * Earlier turns are sent without their thinking blocks. Opus 5.5 binds a
 * thinking block to the exact prefix it was produced under, and the prefix
 * here changes on purpose — approving a draft adds a bot to the system
 * prompt, saving a plan changes the plan block — so replaying them would be a
 * 400. The model loses only its old private reasoning; its words, tool calls
 * and tool results stay.
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

Below is what is known about the category: its market and regulation, its risk level, its sectors, the audiences it serves, and the bots already filed here. Your tools give you more: scan_category (sectors with their suitability and the bots in each, and the gaps), scan_audiences (all seventy-three audience groups, what each needs, which this field links, how many bots serve each), read_bot (one bot of this field in full).

The owner works with you in this order:
1. Scan. When the owner asks for a scan, or a conversation starts with no plan saved, call scan_category and scan_audiences (both, in parallel) before recommending anything. For scan_audiences, pass the audience type the field leans to unless the owner wants all. Report in a few lines: what the field has, which sectors and audience groups have no bot, what is weak or duplicated.
2. B2C foundation. Every field needs a consumer side: what a member of the public would come here for. When the brief says "no B2C foundation", or the owner asks, design it before planning bots, and propose it with kind "b2c_design":
   - groups: the B2C groups this field serves, each with one sentence on why. Always weigh the three everyday groups — B2C-EVD-01 Households on a Tight Budget, B2C-EVD-02 Everyday Adults, B2C-EVD-03 First-time AI Users — next to the field's own.
   - useCases: 3 to 6 everyday uses, each a concrete situation in the person's words ("my energy bill went up and I can't pay it", not "a finance assistant"), what they would type first, the groups it is for, and budgetFriendly. At least one must help someone with little money; prefer uses that are free to try and show in one message why AI is worth it.
   Then stop: the owner approves it on the list beside the chat. In a regulated field, a use is the everyday part (understanding a letter, preparing questions), never the regulated advice itself.
3. Plan. Propose the first bots to build, 3 to 6, in order: first the one that would earn or help most, soonest — and an everyday use with no bot yet counts for a lot. Each with a working name, its sector, one audience type and the groups it is for, and one line on why. Save the plan with save_plan (a working list, not a catalogue change; saving it again replaces the items not yet proposed). Tell the owner they can reorder, drop or add.
4. Draft, one bot at a time. Take the next item marked todo. Ask at most two questions that would change the bot (exactly who, what it must refuse, its voice), or none if the plan already answers them. Then write the bot in full and call propose with kind "bot", its planItemId, its sectorId, audienceCodes, and the useCaseId of the everyday use it serves when there is one. Then stop: the owner approves or rejects it on the list beside the chat. When they come back, move to the next item.

How to work:
- Argue for a narrow specialist over a broad one. "A marketing bot" helps nobody; "a bot that audits landing pages against the ASA code" is a product.
- Never propose a bot that duplicates one already here; say which existing bot covers it.
- If the field is regulated, say what the bot must refuse to do. If the audience is children, say what that changes about its voice.
- Keep replies short enough to read. This is a working conversation.
- End every reply with [SUGGESTIONS: a | b | c]: two or three short next steps the owner might click, in the owner's words (e.g. "Draft the next bot", "Change the order").

Proposals:
- Kinds: bot (a full persona; it becomes an inactive draft on approval), sector_description (a better description for one sector, by its id), audiences (segment codes to link to this field, with a note), b2c_design (B2C groups and everyday uses; linked and saved on approval).
- You cannot change the catalogue yourself. A proposal only appears on the owner's list; say so plainly, and never claim something was created or saved.
- If a tool returns an error, fix the input and call it again once.
- A bot's systemPrompt is the artefact that matters: second person ("You are …"), 150–400 words, covering the role, what it knows, how it speaks, what it must not do, and what it does with questions outside its remit. Fill name, tagline, description, welcomeMessage, suggestions and audienceType too.`;

/** Parts the model must not see again: thinking is bound to the prefix it was produced under (see above). */
function withoutReasoning(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({ ...message, parts: message.parts.filter((part) => part.type !== 'reasoning') }));
}

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

  // AI SDK v7 rejects system messages inside `messages` ("Use the instructions
  // option instead"), so both go through `instructions`, which keeps their
  // providerOptions — the cache breakpoint on the first one survives.
  const system: SystemModelMessage = {
    role: 'system',
    content: `${SYSTEM}\n\n---\n\n${context.text}`,
    // Cached: the brief and the bot list are the long, stable part of every request.
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  };
  // The plan changes as the work goes on, so it sits after the cached block.
  const sectorName = (id: number) => context.sectors.find((s) => s.id === id)?.name ?? `sector ${id}`;
  const planNow: SystemModelMessage = { role: 'system', content: `## The plan of first bots, as saved\n${planForModel(thread.plan ?? [], sectorName)}` };

  const scan_category = tool({
    description: 'Scan this category: its sectors (ids, risk, B2C/B2B/B2G suitability), every bot filed here with its audience groups, and the gaps. Read-only.',
    inputSchema: z.object({}),
    execute: async () => (await scanCategory(categoryId)) ?? 'This category is no longer here.',
  });

  const scan_audiences = tool({
    description:
      'Scan the audience groups: what each needs, its tone, how costly a wrong answer is, whether this field links it (and why), and how many bots here and on the platform are for it. Read-only.',
    inputSchema: z.object({ audienceType: z.enum(['B2C', 'B2B', 'B2G']).optional().describe('Only this type; leave out for all seventy-three groups.') }),
    execute: async ({ audienceType }) => (await scanAudiences(categoryId, audienceType)) ?? 'This category is no longer here.',
  });

  const read_bot = tool({
    description: 'Read one bot of this category in full — its system prompt, welcome message and audience groups — to review or avoid duplicating it. Read-only.',
    inputSchema: z.object({ botId: z.number().int().describe('The bot id from scan_category.') }),
    execute: async ({ botId }) => (await readBot(categoryId, botId)) ?? { error: `Bot ${botId} is not filed in this category.` },
  });

  const save_plan = tool({
    description:
      'Save the ordered plan of the first bots to build in this category. A working list shown beside the chat, not a catalogue change. Items already proposed or drafted are kept; the rest are replaced. Returns the plan with each planItemId.',
    inputSchema: planInputSchema,
    execute: async (input) => {
      let outcome: { ok: true; plan: string } | { ok: false; error: string } = { ok: false, error: 'Not saved.' };
      await updateThread(conversationId, (s) => {
        const checked = checkPlan(input, { sectorIds: context.sectorIds, previous: s.plan ?? [] });
        if (!checked.ok) {
          outcome = checked;
          return s;
        }
        outcome = { ok: true, plan: planForModel(checked.plan, sectorName) };
        return { ...s, plan: checked.plan };
      });
      return outcome;
    },
  });

  const propose = tool({
    description:
      'Put a proposal on the owner’s list for this category. Nothing changes until the owner approves it. Returns { ok, proposalId } or { ok: false, error }.',
    inputSchema: proposeInputSchema,
    execute: async (input) => {
      const checked = checkProposal(input, { sectorIds: context.sectorIds, linkedCodes: context.linkedCodes, useCases: context.useCases });
      if (!checked.ok) return { ok: false, error: checked.error };
      const proposal: Proposal = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        summary: input.summary.trim(),
        status: 'pending',
        payload: checked.payload,
      };
      const planItemId = checked.payload.kind === 'bot' ? checked.payload.planItemId : undefined;
      await updateThread(conversationId, (s) => ({
        ...s,
        proposals: [...(s.proposals ?? []), proposal],
        plan: updatePlanItem(s.plan ?? [], planItemId, { status: 'proposed', proposalId: proposal.id }),
      }));
      return { ok: true, proposalId: proposal.id, note: 'On the owner’s list, waiting for approval.' };
    },
  });

  // A breakpoint on the newest message too: the scans are long, and every
  // later turn re-sends them; this way they are read from the cache.
  const history = await convertToModelMessages(withoutReasoning(uiMessages));
  const last = history[history.length - 1];
  if (last) last.providerOptions = { ...last.providerOptions, anthropic: { cacheControl: { type: 'ephemeral' } } };

  const result = streamText({
    model: getModel(registry, 'anthropic', modelId, keys),
    instructions: [system, planNow],
    messages: history,
    tools: { scan_category, scan_audiences, read_bot, save_plan, propose },
    // Room for: two scans, a plan, a proposal and its retry, and the answer; a loop cannot run away.
    stopWhen: stepCountIs(8),
    maxOutputTokens: 16000,
    onFinish: async ({ steps, totalUsage }) => {
      const usage = usageOf(totalUsage);
      // Every step's words, not only the last step's: "Scanning now…" before the
      // tool calls is part of the reply the owner read.
      const content = steps.map((step) => step.text.trim()).filter(Boolean).join('\n\n');
      await db.insert(conversationMessages).values({
        conversationId,
        authorType: 'system',
        content,
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

  // Admin-only: show the real reason instead of the SDK's masked "An error occurred."
  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('[workbench] category agent stream failed', error);
      return error instanceof Error ? error.message : String(error);
    },
  });
}
