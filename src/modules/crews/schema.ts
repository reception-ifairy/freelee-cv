/**
 * Crews module — bot-to-bot orchestration, built on top of group-chat
 * (Phase 6). A crew run is a `conversations` row with `kind: 'crew_run'`;
 * each crew member is a `conversation_participants` row exactly like a room
 * persona, so `runPersonaTurn()` (src/modules/group-chat/mentions.ts) is
 * reused unmodified for every step — no separate "how does a persona reply"
 * code path. See docs/14-crews.md.
 */
import {
  pgTable, text, integer, boolean, timestamp, jsonb, serial, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { teams, users, personas, conversations, conversationMessages } from '@/db/schema';

/**
 * 'graph' (arbitrary DAG of members/conditions) is deliberately not built —
 * schema-ready territory noted in docs/14-crews.md, not implemented; the
 * three modes here cover the realistic v1 use cases (pipeline, fan-out,
 * dynamic-delegation).
 */
export const crewMode = pgEnum('crew_mode', ['sequential', 'parallel', 'supervisor']);
export const crewRunStatus = pgEnum('crew_run_status', [
  'queued', 'running', 'completed', 'failed', 'budget_exceeded', 'max_turns_reached',
]);
export const crewStepStatus = pgEnum('crew_step_status', ['running', 'completed', 'failed']);

export const crews = pgTable('crews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  mode: crewMode('mode').notNull().default('sequential'),
  /** Hard caps enforced by the runner (src/modules/crews/runner.ts), not suggestions. */
  budgetCredits: integer('budget_credits').notNull().default(50),
  maxTurns: integer('max_turns').notNull().default(6),
  /**
   * Case-insensitive substrings — if a member's reply contains one, the run
   * stops early (`stopReason: 'stop_condition_matched'`) instead of running
   * out the clock. Optional; `[]` means "run until maxTurns/budget."
   */
  stopConditions: jsonb('stop_conditions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdBy: text('created_by').notNull().references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crewMembers = pgTable('crew_members', {
  id: serial('id').primaryKey(),
  crewId: text('crew_id').notNull().references(() => crews.id, { onDelete: 'cascade' }),
  personaId: integer('persona_id').notNull().references(() => personas.id, { onDelete: 'cascade' }),
  /** Turn order for 'sequential' mode; ignored by 'parallel'/'supervisor'. */
  position: integer('position').notNull().default(0),
  /** Appended to the persona's system prompt for this crew's context only — e.g. "You draft; you do not approve." */
  instructions: text('instructions'),
  /** Exactly one member should be true when mode='supervisor' — the runner picks the first if more than one is marked. */
  isSupervisor: boolean('is_supervisor').notNull().default(false),
});

export const crewRuns = pgTable('crew_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  crewId: text('crew_id').notNull().references(() => crews.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  /** The pinned kind='crew_run' conversation this run's steps are written into — SSE progress "for free" via Phase 6's realtime.ts. */
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  status: crewRunStatus('status').notNull().default('queued'),
  input: text('input').notNull(),
  budgetCredits: integer('budget_credits').notNull(),
  creditsSpent: integer('credits_spent').notNull().default(0),
  maxTurns: integer('max_turns').notNull(),
  turnCount: integer('turn_count').notNull().default(0),
  stopReason: text('stop_reason'),
  triggeredBy: text('triggered_by').notNull().references(() => users.id),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crewRunSteps = pgTable('crew_run_steps', {
  id: serial('id').primaryKey(),
  crewRunId: text('crew_run_id').notNull().references(() => crewRuns.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  crewMemberId: integer('crew_member_id').references(() => crewMembers.id, { onDelete: 'set null' }),
  personaId: integer('persona_id').notNull().references(() => personas.id),
  conversationMessageId: text('conversation_message_id').references(() => conversationMessages.id, { onDelete: 'set null' }),
  status: crewStepStatus('status').notNull().default('running'),
  creditsCost: integer('credits_cost').notNull().default(0),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const crewsRelations = relations(crews, ({ one, many }) => ({
  team: one(teams, { fields: [crews.teamId], references: [teams.id] }),
  creator: one(users, { fields: [crews.createdBy], references: [users.id] }),
  members: many(crewMembers),
  runs: many(crewRuns),
}));

export const crewMembersRelations = relations(crewMembers, ({ one }) => ({
  crew: one(crews, { fields: [crewMembers.crewId], references: [crews.id] }),
  persona: one(personas, { fields: [crewMembers.personaId], references: [personas.id] }),
}));

export const crewRunsRelations = relations(crewRuns, ({ one, many }) => ({
  crew: one(crews, { fields: [crewRuns.crewId], references: [crews.id] }),
  conversation: one(conversations, { fields: [crewRuns.conversationId], references: [conversations.id] }),
  steps: many(crewRunSteps),
}));

export const crewRunStepsRelations = relations(crewRunSteps, ({ one }) => ({
  run: one(crewRuns, { fields: [crewRunSteps.crewRunId], references: [crewRuns.id] }),
  member: one(crewMembers, { fields: [crewRunSteps.crewMemberId], references: [crewMembers.id] }),
  persona: one(personas, { fields: [crewRunSteps.personaId], references: [personas.id] }),
}));

export type Crew = typeof crews.$inferSelect;
export type NewCrew = typeof crews.$inferInsert;
export type CrewMember = typeof crewMembers.$inferSelect;
export type NewCrewMember = typeof crewMembers.$inferInsert;
export type CrewRun = typeof crewRuns.$inferSelect;
export type CrewRunStep = typeof crewRunSteps.$inferSelect;
