import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationMessages } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getProviderRegistry, getModel, resolveProviderKeys, resolveProviderId } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';
import { categoryBrief, briefForModel } from '@/lib/taxonomy/brief';

/**
 * The design workbench's streaming endpoint.
 *
 * Separate from `/api/chat` on purpose, and the differences are the reason it
 * exists rather than a flag on that route:
 *
 * - **Nobody is billed.** `/api/chat` gates on a wallet balance and spends
 *   credits in `onFinish`. This is the operator's own tooling on the platform
 *   team; charging them to design their own product would be theatre.
 * - **Authorisation is `requireAdmin`, not `assertChatAccess`.** That function
 *   is an owner-id or guest-cookie match with no concept of an admin.
 * - **There is no persona yet.** That is the whole point of the screen — the
 *   system prompt is the *category brief*, not a persona's.
 *
 * Messages persist to `conversations` / `conversation_messages` with
 * `kind: 'playground'`, an enum value reserved since the group-chat module
 * shipped and never written until now.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  id: z.string().min(1),
  messages: z.array(z.custom<UIMessage>()).min(1),
  categoryId: z.coerce.number().int(),
});

const SYSTEM = `You are a bot architect. You help design AI specialists for a marketplace of them.

You are given a briefing on one field: its market, its regulation, its risk level, the specialisms
inside it, and the audiences it serves. Everything in that briefing is researched — use it, and say
when it points somewhere the operator may not have considered.

How to work:
- Ask before assuming. One good question beats three paragraphs of guesswork.
- Argue for a *narrow* specialist over a broad one. "A marketing bot" helps nobody; "a bot that
  audits landing pages against the ASA code" is a product.
- Ground every suggestion in the briefing. If the field is regulated, say what the bot must refuse
  to do. If the audience is children, say what that changes about its voice.
- Be concrete about the system prompt. That is the artefact being designed.
- Keep replies short enough to read. This is a working conversation, not a report.

When the operator asks you to write the persona out, produce a single JSON object and nothing else,
inside a \`\`\`json fence, with these keys: name, tagline, description, expertise, systemPrompt,
welcomeMessage, suggestions (max 4), knowledgeDomains, audienceType (B2B|B2C|B2G), interactionStyle
(formal|casual|enthusiastic|concise|socratic), approachToUnknown
(admit_ignorance|educated_guess|ask_clarifying), promptTechnique (direct|chain_of_thought), and
personality (each of warmth, humor, formality, curiosity, patience, directness, creativity, rigor,
encouragement, storytelling as 0-100).`;

export async function POST(request: Request) {
  const admin = await requireAdmin();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return new Response('Bad request', { status: 400 });
  const { id: conversationId, messages: uiMessages, categoryId } = parsed.data;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation || conversation.kind !== 'playground') {
    return new Response('Not a workbench conversation', { status: 404 });
  }

  const brief = await categoryBrief(categoryId);
  if (!brief) return new Response('Unknown category', { status: 404 });

  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(await getSettingString('ai_default_provider', 'openai'));
  const modelId =
    (await getSettingString(`${providerId}_default_model`)) || registry[providerId]?.defaultModel;
  if (!modelId) return new Response('No model configured', { status: 503 });
  const keys = await resolveProviderKeys(providerId);

  // Persist the operator's turn before the model sees it, so a stream that dies
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
    await db.insert(conversationMessages).values({
      conversationId,
      authorType: 'user',
      authorId: admin.id,
      content: userText,
      position: next,
    });
  }

  const result = streamText({
    model: getModel(registry, providerId, modelId, keys),
    system: `${SYSTEM}\n\n---\n\n${briefForModel(brief)}`,
    messages: await convertToModelMessages(uiMessages),
    temperature: 0.7,
    onFinish: async ({ text }) => {
      await db.insert(conversationMessages).values({
        conversationId,
        authorType: 'system',
        content: text,
        position: next + 1,
      });
      await db
        .update(conversations)
        .set({ messageCount: sql`${conversations.messageCount} + 2`, lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
    },
  });

  return result.toUIMessageStreamResponse();
}
