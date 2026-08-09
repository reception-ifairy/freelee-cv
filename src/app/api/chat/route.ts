import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from 'ai';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { chats, messages, personas, personaVersions, promptModifiers, usageEvents } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { isAssistantPersona, DEFAULT_ASSISTANT_GUEST_MESSAGES } from '@/lib/assistant/config';
import { checkRateLimit, callerIp } from '@/lib/rate-limit';
import { assertChatAccess } from '@/server/actions/chat';
import { getModel, resolveProviderId, resolveTierModel, providerIsConfigured, getProviderRegistry } from '@/lib/ai/registry';
import { searchMany } from '@/lib/knowledge/registry';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';
import { narrativePromptFragment } from '@/lib/chat/layouts';
import { findTool } from '@/lib/tools/registry';
import { buildSystemPrompt } from '@/lib/persona/prompt';
import {
  costForTokens, spendCredits, getBalanceForTeam, MINIMUM_CHARGE, InsufficientCreditsError,
} from '@/lib/billing/credits';
import { hasActiveEntitlement } from '@/lib/billing/entitlements';
import { getSettingInt, getSettingString } from '@/lib/settings';
import { moderateInput } from '@/lib/moderation/filter';
import { storeDataUrl } from '@/lib/media/store';

/** A hard cap so one message can't post a hundred images at the model (or at the disk). */
const MAX_IMAGES_PER_MESSAGE = 4;
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

  /**
   * The site assistant answers support questions and is never billed — see
   * docs/37-site-assistant.md.
   *
   * Derived here from the configured slug and this chat's own `personaId`.
   * Deliberately **not** taken from the request: a client-supplied flag would
   * let anyone talk to any paid persona for free by sending it.
   */
  const isAssistant = await isAssistantPersona(chat.personaId);

  // A free, unauthenticated LLM on every public page needs a ceiling, or one
  // script can drain the account's API quota. Keyed on the signed-in user or
  // the guest cookie, with the caller IP as a last resort.
  if (isAssistant) {
    const gate = checkRateLimit({
      name: 'assistant-message',
      key: user?.id ?? chat.guestToken ?? callerIp(request),
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (!gate.ok) {
      return new Response(
        JSON.stringify({ error: 'That is a lot of questions at once. Please wait a moment and try again.' }),
        { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(gate.retryAfter) } },
      );
    }
  }

  // A pass or subscription can grant unmetered platform access — see
  // docs/12-billing-overhaul.md. Checked once here (gates entry) and reused
  // in onFinish below (gates whether credits actually get spent) rather than
  // queried twice.
  const coveredByPass = user ? await hasActiveEntitlement(chat.teamId, 'platform') : false;

  if (user) {
    const required = flatCost > 0 ? flatCost : MINIMUM_CHARGE;

    // Support is free for customers too: charging someone to ask about their
    // own invoice is exactly the wrong moment to meter.
    if (!isAssistant && !coveredByPass && (await getBalanceForTeam(chat.teamId)) < required) {
      return fail('You are out of credits. Top up to keep chatting.', 402);
    }
  } else {
    // The assistant gets its own allowance, so asking for help never eats the
    // free messages someone was going to spend trying a persona.
    const limit = isAssistant
      ? await getSettingInt('site_assistant_guest_messages', DEFAULT_ASSISTANT_GUEST_MESSAGES)
      : await getSettingInt('guest_free_messages', Number(process.env.GUEST_FREE_MESSAGES ?? 3));
    const sent = await db.$count(messages, and(eq(messages.chatId, chatId), eq(messages.role, 'user')));

    if (sent >= limit) {
      return fail(
        isAssistant
          ? `You have used your ${limit} free messages. Create a free account to keep talking.`
          : `You have used your ${limit} free messages. Create a free account to keep going.`,
        402,
      );
    }
  }

  /* --------------------------- Persist the prompt -------------------------- */
  const latest = uiMessages[uiMessages.length - 1];
  const userText = latest.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  const hasImageParts = latest.parts.some((part) => part.type === 'file');
  if (!userText && !hasImageParts) return fail('Your message is empty.');

  // Runs before the message is persisted or sent anywhere, so a blocked
  // message costs nothing and never reaches the provider. Word-list only —
  // see src/lib/moderation/filter.ts on what that does and doesn't catch.
  if (version?.capabilities.badwordFilter) {
    const check = await moderateInput(userText);
    if (check.blocked) {
      return fail('That message contains language this assistant will not respond to. Please rephrase it.', 422);
    }
  }

  // Image uploads, only for personas that opted in. A client can put file
  // parts in the body regardless, so they're dropped here rather than trusted
  // — the capability flag is enforced server-side, not just hidden in the UI.
  const canSeeImages = Boolean(version?.capabilities.vision);
  const incomingImages = canSeeImages
    ? latest.parts.filter(
        (part): part is { type: 'file'; mediaType: string; url: string } =>
          part.type === 'file' && typeof (part as { url?: unknown }).url === 'string',
      )
    : [];

  const stored = (
    await Promise.all(incomingImages.slice(0, MAX_IMAGES_PER_MESSAGE).map((p) => storeDataUrl(p.url, 'upload')))
  ).filter((a): a is NonNullable<typeof a> => a !== null);

  const nextPosition = (await db.$count(messages, eq(messages.chatId, chatId))) + 1;

  await db.insert(messages).values({
    chatId,
    role: 'user',
    content: userText,
    attachments: stored,
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
      ? buildSystemPrompt(
          {
            ...version,
            name: persona.name,
            expertise: persona.expertise,
            // A per-conversation override beats the persona's authored
            // default; NULL on the chat means "inherit" (docs/24-chat-controls.md).
            interactionStyle: chat.interactionStyle ?? version.interactionStyle,
            approachToUnknown: chat.approachToUnknown ?? version.approachToUnknown,
          },
          selectedModifiers,
          undefined,
          groundingChunks,
        ) + narrativePromptFragment(layoutKey)
      : undefined;

  // Only the tail of the conversation is resent — more context costs credits.
  // The same enforcement applied to the *history*: a persona without vision
  // must never receive an image, even one attached before the flag was
  // turned off. Stripping here keeps convertToModelMessages honest.
  const history = uiMessages.slice(-(version?.historyMessages ?? 8)).map((message) =>
    canSeeImages ? message : { ...message, parts: message.parts.filter((part) => part.type !== 'file') },
  );
  const startedAt = Date.now();

  // Tools the persona is allowed to invoke. An unknown key in the column is
  // skipped rather than throwing — a tool removed from the registry must not
  // break every persona that still lists it.
  const enabledTools = (version?.tools ?? [])
    .map(findTool)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const toolSet = enabledTools.length
    ? Object.fromEntries(
        enabledTools.map((t) => [
          t.key,
          tool({ description: t.description, inputSchema: t.inputSchema, execute: t.execute as never }),
        ]),
      )
    : undefined;

  const result = streamText({
    model: getModel(registry, providerId, modelId, {
      apiKey: apiKeyFromSettings || undefined,
      baseUrl: baseUrlFromSettings || undefined,
    }),
    system,
    tools: toolSet,
    // Without this the model calls a tool and the turn ends there — the user
    // sees nothing. Each step is one model round trip, so the cap bounds both
    // latency and cost; 4 is enough for call → read → call again → answer.
    stopWhen: toolSet ? stepCountIs(5) : undefined,
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

      // `isAssistant` again rather than a cheaper local flag: this is the line
      // that actually moves money, so it reads the same server-derived truth
      // the entry guard did.
      if (user && !coveredByPass && !isAssistant) {
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
