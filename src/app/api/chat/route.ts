import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { chats, messages, personas, personaVersions, promptModifiers, usageEvents } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { assertChatAccess } from '@/server/actions/chat';
import { getModel, resolveProviderId, resolveTierModel, providerIsConfigured, getProviderRegistry } from '@/lib/ai/registry';
import { searchMany } from '@/lib/knowledge/registry';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';
import { narrativePromptFragment } from '@/lib/chat/layouts';
import { buildSystemPrompt } from '@/lib/persona/prompt';
import {
  costForTokens, spendCredits, getBalanceForTeam, MINIMUM_CHARGE, InsufficientCreditsError,
} from '@/lib/billing/credits';
import { hasActiveEntitlement } from '@/lib/billing/entitlements';
import { getSettingInt, getSettingString } from '@/lib/settings';
import { truncate } from '@/lib/utils';

// Long generations need a Node runtime and a generous ceiling.
export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  id: z.string().min(1),
  messages: z.array(z.custom<UIMessage>()).min(1),
});

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return fail('Malformed request.');

  const { id: chatId, messages: uiMessages } = parsed.data;

  // Same ownership rule as every chat mutation — owner, or matching guest cookie.
  const chat = await assertChatAccess(chatId);
  if (!chat) return fail('You do not have access to this conversation.', 403);

  const user = await currentUser();

  const [persona] = chat.personaId
    ? await db.select().from(personas).where(eq(personas.id, chat.personaId)).limit(1)
    : [undefined];

  // Prompt/model/parameter content lives on persona_versions since Phase 4
  // (docs/11-persona-versioning.md) — resolve the effective version: pinned
  // at chat-creation time (chat.personaVersionId, only set when the persona
  // has pinVersioning=true) if present, otherwise the persona's *current*
  // version, resolved fresh on every request. For the pinVersioning=false
  // personas (every pre-2026-08-06 persona, and the default for new ones),
  // this is exactly today's "always resolve live" behavior — editing in
  // admin mutates the current version in place, so it's visible immediately.
  const versionId = chat.personaVersionId ?? persona?.currentVersionId;
  const [version] = versionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, versionId)).limit(1)
    : [undefined];

  // chat.aiProvider/chat.model are reserved for a possible future "override
  // this one thread's model" feature and are null for virtually every chat.
  const providerId = resolveProviderId(chat.aiProvider ?? version?.aiProvider);
  // Queried once per request (React cache()) — an admin edit to the registry
  // (pricing, status, tier mapping) takes effect on the very next request.
  const registry = await getProviderRegistry();

  // Per-thread override (rare) → live tier resolution → explicit version model
  // → admin default → provider default. Tier is resolved fresh against the
  // registry every request, so a registry update (e.g. a model deprecation)
  // instantly fixes every persona on that tier with no data migration.
  const modelId =
    chat.model ||
    resolveTierModel(registry, providerId, version?.modelTier as 'fast' | 'balanced' | 'advanced' | null | undefined) ||
    version?.model ||
    (await getSettingString(`${providerId}_default_model`)) ||
    registry[providerId].defaultModel;

  // The settings table wins over the environment, so a key (or, for a
  // self-hosted endpoint like Ollama, a base URL) can be rotated from the
  // admin panel without a redeploy.
  const apiKeyFromSettings = await getSettingString(`${providerId}_api_key`);
  const baseUrlFromSettings = await getSettingString(`${providerId}_base_url`);

  if (!providerIsConfigured(registry, providerId, apiKeyFromSettings || null)) {
    return fail('No AI provider is configured yet. Add an API key in the admin settings.', 503);
  }

  /* ----------------------------- Spend guards ----------------------------- */
  const flatCost = persona?.creditsPerMessage ?? 0;

  // A pass or subscription can grant unmetered platform access — see
  // docs/12-billing-overhaul.md. Checked once here (gates entry) and reused
  // in onFinish below (gates whether credits actually get spent) rather than
  // queried twice.
  const coveredByPass = user ? await hasActiveEntitlement(chat.teamId, 'platform') : false;

  if (user) {
    const required = flatCost > 0 ? flatCost : MINIMUM_CHARGE;

    if (!coveredByPass && (await getBalanceForTeam(chat.teamId)) < required) {
      return fail('You are out of credits. Top up to keep chatting.', 402);
    }
  } else {
    const limit = await getSettingInt('guest_free_messages', Number(process.env.GUEST_FREE_MESSAGES ?? 3));
    const sent = await db.$count(messages, and(eq(messages.chatId, chatId), eq(messages.role, 'user')));

    if (sent >= limit) {
      return fail(`You have used your ${limit} free messages. Create a free account to keep going.`, 402);
    }
  }

  /* --------------------------- Persist the prompt -------------------------- */
  const latest = uiMessages[uiMessages.length - 1];
  const userText = latest.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  if (!userText) return fail('Your message is empty.');

  const nextPosition = (await db.$count(messages, eq(messages.chatId, chatId))) + 1;

  await db.insert(messages).values({
    chatId,
    role: 'user',
    content: userText,
    position: nextPosition,
    status: 'complete',
  });

  /* ------------------------------ Build prompt ----------------------------- */
  const selectedModifiers = chat.modifierIds.length
    ? await db
        .select()
        .from(promptModifiers)
        .where(and(inArray(promptModifiers.id, chat.modifierIds), eq(promptModifiers.isActive, true)))
    : [];

  // Only fetched for personas that opted into a knowledge source — never
  // blocks or breaks a turn if the source is unavailable (see searchMany).
  const groundingChunks = version?.groundingSources.length
    ? await searchMany(version.groundingSources, userText)
    : [];

  // The narrative layouts (story / screenplay / gamebook) change the *output*,
  // not just the frame — the model has to be told to emit narration, named
  // dialogue and action beats for src/lib/chat/narrative.ts to have anything
  // to parse. Prompting without rendering, or rendering without prompting,
  // would each be useless on their own. See docs/23-chat-layouts.md.
  const layoutKey = persona
    ? await resolveLayoutForPersona(persona.id, version?.chatLayout, version?.audienceType, version?.audienceSegments)
    : 'default';

  const system =
    persona && version
      ? buildSystemPrompt({ ...version, name: persona.name, expertise: persona.expertise }, selectedModifiers, undefined, groundingChunks) +
        narrativePromptFragment(layoutKey)
      : undefined;

  // Only the tail of the conversation is resent — more context costs credits.
  const history = uiMessages.slice(-(version?.historyMessages ?? 8));
  const startedAt = Date.now();

  const result = streamText({
    model: getModel(registry, providerId, modelId, {
      apiKey: apiKeyFromSettings || undefined,
      baseUrl: baseUrlFromSettings || undefined,
    }),
    system,
    messages: await convertToModelMessages(history),
    temperature: version?.temperature ?? 0.8,
    topP: version?.topP ?? undefined,
    frequencyPenalty: version?.frequencyPenalty || undefined,
    presencePenalty: version?.presencePenalty || undefined,
    maxOutputTokens: version?.maxTokens ?? undefined,

    /*
     * Billing happens here, after the stream completes, using the usage the
     * provider actually reported — never an estimate made up front.
     */
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? Math.ceil(text.length / 4);
      const cost = flatCost > 0 ? flatCost : costForTokens(registry, providerId, modelId, inputTokens, outputTokens);

      const [assistantRow] = await db
        .insert(messages)
        .values({
          chatId,
          role: 'assistant',
          content: text,
          model: modelId,
          aiProvider: providerId,
          inputTokens,
          outputTokens,
          creditsCost: cost,
          latencyMs: Date.now() - startedAt,
          position: nextPosition + 1,
          status: 'complete',
        })
        .returning();

      let creditsCharged = 0;

      if (user && !coveredByPass) {
        try {
          await spendCredits(user.id, cost, {
            teamId: chat.teamId,
            description: `Chat — ${modelId}`,
            messageId: assistantRow.id,
            meta: { provider: providerId, model: modelId, inputTokens, outputTokens },
          });
          creditsCharged = cost;
        } catch (error) {
          // The reply was already delivered; never claw it back mid-stream.
          if (error instanceof InsufficientCreditsError) {
            console.warn(`[billing] balance went short for user ${user.id}`);
          } else {
            throw error;
          }
        }
      }

      // Raw usage fact — recorded regardless of who paid (or whether a pass
      // covered it), and never rewritten later even if pricing changes.
      // Alongside `messages.creditsCost` (kept for today's UI), not instead
      // of it. See docs/12-billing-overhaul.md.
      await db.insert(usageEvents).values({
        teamId: chat.teamId,
        userId: user?.id ?? null,
        personaId: persona?.id ?? null,
        personaVersionId: version?.id ?? null,
        chatId,
        messageId: assistantRow.id,
        aiProviderKey: providerId,
        operation: 'chat',
        inputTokens,
        outputTokens,
        creditsCharged,
        coveredByPass,
        latencyMs: Date.now() - startedAt,
      });

      await db
        .update(chats)
        .set({
          messagesCount: nextPosition + 1,
          creditsSpent: chat.creditsSpent + creditsCharged,
          tokensUsed: chat.tokensUsed + inputTokens + outputTokens,
          lastMessageAt: new Date(),
          title: chat.title ?? truncate(userText, 48),
        })
        .where(eq(chats.id, chatId));

      if (persona) {
        await db
          .update(personas)
          .set({ messagesCount: persona.messagesCount + 1 })
          .where(eq(personas.id, persona.id));
      }
    },

    onError: async ({ error }) => {
      console.error('[chat] stream failed', error);
      await db.insert(messages).values({
        chatId,
        role: 'assistant',
        content: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        position: nextPosition + 1,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}

/** Loads persisted history when a conversation is reopened. */
export async function GET(request: Request) {
  const chatId = new URL(request.url).searchParams.get('chatId');
  if (!chatId) return fail('chatId is required.');

  const chat = await assertChatAccess(chatId);
  if (!chat) return fail('You do not have access to this conversation.', 403);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.position));

  return Response.json({ messages: rows });
}
