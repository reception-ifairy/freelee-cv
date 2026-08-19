/**
 * Group Chat module — own tables, re-exported through src/db/schema.ts's
 * tail (`export * from '@/modules/group-chat/schema'`) per the module
 * architecture convention (docs/08-module-architecture.md). Deliberately a
 * **new, parallel** table family, not a migration of `chats`/`messages` —
 * see docs/13-group-chat.md for why (risk: migrating the single most
 * heavily-used live table for modeling purity, with no rollback tooling
 * available, isn't worth it).
 *
 * Circular import with src/db/schema.ts (this file imports `teams`/`users`/
 * `personas`/`personaVersions` from it; it re-exports from here) resolves
 * fine — Drizzle's `.references(() => otherTable.column)` is a lazy closure
 * specifically so cross-file/circular table references work, the same
 * mechanism already used for same-file pairs like teams<->users.
 */
import {
  pgTable, text, integer, bigint, boolean, timestamp, jsonb, real,
  uniqueIndex, index, pgEnum, serial, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { teams, users, personaVersions, projects } from '@/db/schema';

export const conversationKind = pgEnum('conversation_kind', ['room', 'crew_run', 'playground']);
export const conversationVisibility = pgEnum('conversation_visibility', ['private', 'team', 'link']);
export const participantType = pgEnum('participant_type', ['user', 'persona']);
export const participantRole = pgEnum('participant_role', ['owner', 'editor', 'commenter', 'viewer']);
export const conversationMessageAuthorType = pgEnum('conversation_message_author_type', ['user', 'persona', 'system']);
export const conversationMessageStatus = pgEnum('conversation_message_status', ['pending', 'complete', 'failed']);

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    kind: conversationKind('kind').notNull().default('room'),
    title: text('title'),
    /** Optional grouping (docs/45). Nulls out with the project; the room survives. */
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  createdBy: text('created_by').notNull().references(() => users.id),
    visibility: conversationVisibility('visibility').notNull().default('team'),
    /** maxPersonasPerRoom override, autoRespond, mentionRequired — see manifest.settingsSchema for platform defaults. */
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    messageCount: integer('message_count').notNull().default(0),
    tokenTotal: integer('token_total').notNull().default(0),
    costTotal: integer('cost_total').notNull().default(0), // credits, not currency — matches chats.creditsSpent's unit
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conversations_team_idx').on(t.teamId, t.lastMessageAt),
    index('conversations_kind_idx').on(t.kind),
  ],
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: serial('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    participantType: participantType('participant_type').notNull(),
    /**
     * Loosely typed on purpose (text, not a real FK) — points at either
     * `users.id` (uuid text) or `personas.id` (integer, stored as its string
     * form) depending on `participantType`. Same pattern as
     * `entitlements.sourceId`. A real persona is a participant exactly like
     * a human — the one modeling choice that makes "group chat with bots"
     * need no separate code path from "group chat with people."
     */
    participantId: text('participant_id').notNull(),
    /** Pins which version replies, when set — mirrors chats.personaVersionId (Phase 4). Null for user participants. */
    personaVersionId: integer('persona_version_id').references(() => personaVersions.id, { onDelete: 'set null' }),
    role: participantRole('role').notNull().default('editor'),
    displayName: text('display_name'),
    /** `@handle` — unique within the conversation, drives mention routing (src/modules/group-chat/mentions.ts). */
    mentionHandle: text('mention_handle').notNull(),
    autoRespond: boolean('auto_respond').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('conversation_participants_identity_idx').on(t.conversationId, t.participantType, t.participantId),
    uniqueIndex('conversation_participants_handle_idx').on(t.conversationId, t.mentionHandle),
  ],
);

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    /** Branching/regeneration — schema-ready, no UI built yet (see docs/13-group-chat.md). */
    parentId: text('parent_id').references((): AnyPgColumn => conversationMessages.id),
    /** Side-thread root — schema-ready, no UI built yet. */
    threadRootId: text('thread_root_id').references((): AnyPgColumn => conversationMessages.id),
    authorType: conversationMessageAuthorType('author_type').notNull(),
    /** users.id, personas.id (as text), or null for authorType='system'. */
    authorId: text('author_id'),
    personaVersionId: integer('persona_version_id').references(() => personaVersions.id, { onDelete: 'set null' }),
    content: text('content').notNull().default(''),
    /** `[{type:'persona', participantId, handle}]` — parsed from `@handle`s, drives routing. */
    mentions: jsonb('mentions').$type<{ participantId: string; handle: string }[]>().notNull().default(sql`'[]'::jsonb`),
    model: text('model'),
    aiProvider: text('ai_provider'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    creditsCost: integer('credits_cost').notNull().default(0),
    latencyMs: integer('latency_ms'),
    status: conversationMessageStatus('status').notNull().default('complete'),
    error: text('error'),
    position: integer('position').notNull().default(0),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conversation_messages_conversation_idx').on(t.conversationId, t.position),
    index('conversation_messages_thread_idx').on(t.threadRootId),
  ],
);

export const messageReactions = pgTable(
  'message_reactions',
  {
    id: serial('id').primaryKey(),
    messageId: text('message_id').notNull().references(() => conversationMessages.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('message_reactions_unique_idx').on(t.messageId, t.userId, t.emoji)],
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  team: one(teams, { fields: [conversations.teamId], references: [teams.id] }),
  creator: one(users, { fields: [conversations.createdBy], references: [users.id] }),
  participants: many(conversationParticipants),
  messages: many(conversationMessages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationParticipants.conversationId], references: [conversations.id] }),
  personaVersion: one(personaVersions, { fields: [conversationParticipants.personaVersionId], references: [personaVersions.id] }),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one, many }) => ({
  conversation: one(conversations, { fields: [conversationMessages.conversationId], references: [conversations.id] }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(conversationMessages, { fields: [messageReactions.messageId], references: [conversationMessages.id] }),
  user: one(users, { fields: [messageReactions.userId], references: [users.id] }),
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
