import 'server-only';
import { generateText } from 'ai';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  conversationMessages,
  conversationParticipants,
  conversations,
  personaVersions,
  personas,
  type ConversationMessage,
  type ConversationParticipant,
} from '@/db/schema';
import { getModel, resolveProviderId, resolveTierModel, getProviderRegistry } from '@/lib/ai/registry';
import { buildSystemPrompt } from '@/lib/persona/prompt';
import { costForTokens, spendCredits, getBalanceForTeam, MINIMUM_CHARGE, InsufficientCreditsError } from '@/lib/billing/credits';
import { hasActiveEntitlement } from '@/lib/billing/entitlements';
import { notifyConversation } from './realtime';

export const DEFAULT_MAX_PERSONAS_PER_ROOM = 5;

/**
 * `@handle` → participant, parsed from a human-authored message.
 * `@all-personas` mentions every non-departed persona participant (capped by
 * the caller). Personas are never scanned for mentions — only the caller
 * (postMessageAction) decides when to invoke this, and it's only ever called
 * on user-authored messages. That's the whole enforcement of "personas never
 * auto-reply to personas" — see docs/13-group-chat.md.
 */
export function parseMentions(
  content: string,
  participants: ConversationParticipant[],
  maxPersonas = DEFAULT_MAX_PERSONAS_PER_ROOM,
): ConversationParticipant[] {
  const tokens = [...content.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase());
  if (tokens.length === 0) return [];

  const personaParticipants = participants.filter((p) => p.participantType === 'persona' && !p.leftAt);

  if (tokens.includes('all-personas') || tokens.includes('all')) {
    return personaParticipants.slice(0, maxPersonas);
  }

  const handles = new Set(tokens);
  return personaParticipants.filter((p) => handles.has(p.mentionHandle.toLowerCase())).slice(0, maxPersonas);
}

/**
 * Atomically reserves the next `position`/bumps `messageCount` in one
 * statement — `UPDATE … SET message_count = message_count + 1 RETURNING`
 * serialises on Postgres's own row lock, so this is race-free even when
 * several persona turns are being written concurrently (one `@all-personas`
 * message = N turns racing to post). A plain "SELECT count(*) then insert"
 * (what direct 1:1 chat's route.ts does) is fine there because there's only
 * ever one writer per chat; a room can have several at once.
 */
async function reserveNextPosition(conversationId: string): Promise<number> {
  const [row] = await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 1`, lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning({ messageCount: conversations.messageCount });

  if (!row) throw new Error(`Conversation ${conversationId} not found.`);
  return row.messageCount;
}

async function bumpTotals(conversationId: string, tokens: number, credits: number) {
  await db
    .update(conversations)
    .set({
      tokenTotal: sql`${conversations.tokenTotal} + ${tokens}`,
      costTotal: sql`${conversations.costTotal} + ${credits}`,
    })
    .where(eq(conversations.id, conversationId));
}

const DEFAULT_CONTEXT_NOTE =
  '\n\n## Group chat\nYou are one of several participants — human and AI — in a shared room. ' +
  'Reply only to what was directed at you; do not impersonate other participants.';

type TurnParams = {
  conversationId: string;
  teamId: string;
  participant: ConversationParticipant; // participantType === 'persona'
  triggeringUserId: string;
  historyMessages?: number;
  /**
   * Overrides the default "## Group chat" system-prompt note. Crews
   * (src/modules/crews/runner.ts) pass a "## Crew" note carrying the
   * member's per-crew instructions instead — the only reason this is a
   * parameter rather than hardcoded, so crew steps can reuse this function
   * unmodified rather than duplicating everything below it.
   */
  contextNote?: string;
};

/**
 * One persona's reply in a room — the group-chat equivalent of
 * src/app/api/chat/route.ts's POST handler, generalised to run once per
 * `@mention` (in parallel with its siblings) instead of once per request,
 * and **non-streaming** (received as a whole message when ready, not
 * token-by-token) — a deliberate simplification vs. direct 1:1 chat's
 * streaming; see docs/13-group-chat.md for why. Reuses
 * buildSystemPrompt/getModel/costForTokens/spendCredits exactly as the
 * direct-chat path does — none of that logic was duplicated. Also the
 * execution primitive for crew steps (docs/14-crews.md) — a crew member's
 * turn is this same function, just triggered by the crew runner instead of
 * a human's `@mention`.
 */
export async function runPersonaTurn({
  conversationId, teamId, participant, triggeringUserId, historyMessages = 12, contextNote = DEFAULT_CONTEXT_NOTE,
}: TurnParams): Promise<ConversationMessage> {
  const personaId = Number(participant.participantId);
  const position = await reserveNextPosition(conversationId);

  const [persona] = await db.select().from(personas).where(eq(personas.id, personaId)).limit(1);
  if (!persona) {
    return insertFailure(conversationId, position, personaId, 'Persona not found.');
  }

  const versionId = participant.personaVersionId ?? persona.currentVersionId;
  const [version] = versionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, versionId)).limit(1)
    : [undefined];

  if (!version) {
    return insertFailure(conversationId, position, personaId, 'This persona has no published version.');
  }

  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(version.aiProvider);
  const modelId =
    resolveTierModel(registry, providerId, version.modelTier as 'fast' | 'balanced' | 'advanced' | null | undefined) ||
    version.model ||
    registry[providerId].defaultModel;

  const coveredByPass = await hasActiveEntitlement(teamId, 'platform');
  if (!coveredByPass && (await getBalanceForTeam(teamId)) < MINIMUM_CHARGE) {
    return insertFailure(conversationId, position, personaId, 'The team is out of credits.');
  }

  // Room history, labelled by speaker — "Anna: …", "@strateg: …" — so the
  // model knows who said what in a multi-party thread. Plain user/assistant
  // roles can't carry that on their own the way they can in 1:1 chat.
  const history = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.position))
    .limit(historyMessages);

  // Who actually said each line.
  //
  // This used to label every past persona message with
  // `participant.mentionHandle` — the handle of the persona *currently
  // speaking*. In any room with two personas, and in every crew run, each
  // member was therefore told it had said everything its teammates said.
  // The whole premise of multi-persona work is that they can tell each other
  // apart, so this quietly undermined the feature it was part of.
  const speakers = await db
    .select({
      participantId: conversationParticipants.participantId,
      participantType: conversationParticipants.participantType,
      mentionHandle: conversationParticipants.mentionHandle,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));

  const handleFor = (authorType: string, authorId: string | null) =>
    speakers.find((s) => s.participantType === authorType && s.participantId === authorId)?.mentionHandle;

  const aiMessages = history
    .reverse()
    .filter((m) => m.content.trim())
    .map((m) => ({
      role: (m.authorType === 'persona' ? 'assistant' : 'user') as 'assistant' | 'user',
      content:
        m.authorType === 'user'
          ? m.content
          // Falls back to the speaker's own handle only when the author has
          // left the conversation and their participant row is gone — rare,
          // and better than an unlabelled line.
          : `[${handleFor(m.authorType, m.authorId) ?? participant.mentionHandle}] ${m.content}`,
    }));

  const system = buildSystemPrompt({ ...version, name: persona.name, expertise: persona.expertise }) + contextNote;

  const startedAt = Date.now();
  let text: string;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const result = await generateText({
      model: getModel(registry, providerId, modelId),
      system,
      messages: aiMessages,
      temperature: version.temperature,
      topP: version.topP ?? undefined,
    });
    text = result.text;
    inputTokens = result.usage?.inputTokens ?? 0;
    outputTokens = result.usage?.outputTokens ?? Math.ceil(text.length / 4);
  } catch (error) {
    console.error(`[group-chat] persona turn failed for ${persona.slug}`, error);
    return insertFailure(conversationId, position, personaId, 'This persona failed to respond.');
  }

  const cost = costForTokens(registry, providerId, modelId, inputTokens, outputTokens);
  let creditsCharged = 0;

  if (!coveredByPass) {
    try {
      await spendCredits(triggeringUserId, cost, {
        teamId,
        description: `Room reply — ${persona.name}`,
        meta: { conversationId, personaId, provider: providerId, model: modelId },
      });
      creditsCharged = cost;
    } catch (error) {
      if (!(error instanceof InsufficientCreditsError)) throw error;
      console.warn(`[group-chat] balance went short mid-room for team ${teamId}`);
    }
  }

  const [saved] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      authorType: 'persona',
      authorId: String(persona.id),
      personaVersionId: version.id,
      content: text,
      model: modelId,
      aiProvider: providerId,
      inputTokens,
      outputTokens,
      creditsCost: cost,
      latencyMs: Date.now() - startedAt,
      status: 'complete',
      position,
    })
    .returning();

  await bumpTotals(conversationId, inputTokens + outputTokens, creditsCharged);
  await notifyConversation(conversationId, { type: 'message.created', messageId: saved.id });

  return saved;
}

async function insertFailure(conversationId: string, position: number, personaId: number, error: string) {
  const [saved] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      authorType: 'persona',
      authorId: String(personaId),
      status: 'failed',
      error,
      position,
    })
    .returning();

  await notifyConversation(conversationId, { type: 'message.created', messageId: saved.id });
  return saved;
}

/** Runs every mentioned persona's turn in parallel — independent replies, independent billing. */
export async function runMentionedTurns(
  conversationId: string,
  teamId: string,
  mentioned: ConversationParticipant[],
  triggeringUserId: string,
): Promise<ConversationMessage[]> {
  return Promise.all(
    mentioned.map((participant) => runPersonaTurn({ conversationId, teamId, participant, triggeringUserId })),
  );
}

export { reserveNextPosition };
