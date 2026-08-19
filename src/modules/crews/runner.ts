import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  crews, crewMembers, crewRuns, crewRunSteps, conversationParticipants,
  type Crew, type CrewMember, type CrewRun, type ConversationParticipant, type ConversationMessage,
} from '@/db/schema';
import { runPersonaTurn, parseMentions } from '@/modules/group-chat/mentions';

/**
 * The execution engine for a crew run. Every step is a call to Phase 6's
 * `runPersonaTurn()` — a crew member is added as an ordinary
 * `conversation_participants` row at run-creation time (src/modules/crews/
 * actions.ts), so nothing here reimplements "how does a persona reply."
 * Runs synchronously, inside the request that started it (same deliberate
 * simplification as group-chat's `postMessageAction` awaiting every
 * `@mention`'s reply) — no queue/worker infra exists in this app yet, and
 * standing one up purely for crews was judged disproportionate for a v1.
 * `maxTurns` defaults are kept modest (crews.maxTurns, default 6) so a run
 * finishes within a normal request lifetime; see docs/14-crews.md for the
 * tradeoff and what a real background worker would change.
 */

async function loadParticipant(conversationId: string, personaId: number): Promise<ConversationParticipant> {
  const [row] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.participantType, 'persona'),
        eq(conversationParticipants.participantId, String(personaId)),
      ),
    )
    .limit(1);
  if (!row) throw new Error(`Crew member persona ${personaId} is not a participant in conversation ${conversationId}.`);
  return row;
}

function crewNote(crew: Crew, member: CrewMember | undefined): string {
  const base =
    `\n\n## Crew\nYou are one member of an automated crew ("${crew.name}") of AI personas working a ` +
    `task together, in ${crew.mode} mode. Stay strictly in your own role; do not speak for other members.`;
  return member?.instructions ? `${base}\n\nYour specific role: ${member.instructions}` : base;
}

function matchesStopCondition(text: string, stopConditions: string[]): boolean {
  if (stopConditions.length === 0) return false;
  const lower = text.toLowerCase();
  return stopConditions.some((needle) => needle.trim() && lower.includes(needle.toLowerCase()));
}

type RunState = {
  /** Set once a cancel has been observed, so every mode's loop can exit. */
  cancelled?: boolean;
  shouldCancel?: () => Promise<boolean>; turnCount: number; creditsSpent: number };

async function recordStep(
  runId: string,
  position: number,
  member: CrewMember | undefined,
  personaId: number,
  message: ConversationMessage,
  startedAt: Date,
): Promise<void> {
  await db.insert(crewRunSteps).values({
    crewRunId: runId,
    position,
    crewMemberId: member?.id ?? null,
    personaId,
    conversationMessageId: message.id,
    status: message.status === 'failed' ? 'failed' : 'completed',
    creditsCost: message.creditsCost,
    error: message.error,
    // `startedAt` must be passed in, not left to the column default.
    //
    // The default is `defaultNow()`, evaluated by Postgres when the row is
    // INSERTed — which happens *after* the step has finished. So the column
    // recorded when the step ended, and `completed_at - started_at` came out
    // NEGATIVE by the round trip: every duration in this audit trail was
    // meaningless, and nothing read it, so nobody noticed.
    startedAt,
    completedAt: new Date(),
  });
}

async function step(
  run: CrewRun,
  crew: Crew,
  member: CrewMember | undefined,
  personaId: number,
  state: RunState,
  contextNote: string,
): Promise<ConversationMessage> {
  const participant = await loadParticipant(run.conversationId, personaId);
  // Taken before the model call, so the recorded duration is the step's, not
  // the insert's.
  const startedAt = new Date();
  const message = await runPersonaTurn({
    conversationId: run.conversationId,
    teamId: run.teamId,
    participant,
    triggeringUserId: run.triggeredBy,
    contextNote,
  });

  state.turnCount += 1;
  state.creditsSpent += message.creditsCost;
  await recordStep(run.id, state.turnCount, member, personaId, message, startedAt);
  await db.update(crewRuns).set({ turnCount: state.turnCount, creditsSpent: state.creditsSpent }).where(eq(crewRuns.id, run.id));

  return message;
}

/** One place for the cancel probe, so a failing check never aborts a healthy run. */
async function cancelled(state: RunState): Promise<boolean> {
  if (state.cancelled) return true;
  if (!state.shouldCancel) return false;
  try {
    state.cancelled = await state.shouldCancel();
  } catch {
    return false;
  }
  return state.cancelled === true;
}

async function runSequential(run: CrewRun, crew: Crew, members: CrewMember[], state: RunState): Promise<string> {
  for (const member of members) {
    if (await cancelled(state)) return 'cancelled';
    if (state.turnCount >= run.maxTurns) return 'max_turns_reached';
    if (state.creditsSpent >= run.budgetCredits) return 'budget_exceeded';

    const message = await step(run, crew, member, member.personaId, state, crewNote(crew, member));
    if (message.status === 'failed') return 'step_failed';
    if (matchesStopCondition(message.content, crew.stopConditions)) return 'stop_condition_matched';
  }
  return 'sequential_complete';
}

async function runParallel(run: CrewRun, crew: Crew, members: CrewMember[], state: RunState): Promise<string> {
  if (await cancelled(state)) return 'cancelled';
  // Budget used to be checked only *after* the fan-out, so a run that was
  // already over budget still spent a whole extra round before noticing.
  if (state.creditsSpent >= run.budgetCredits) return 'budget_exceeded';
  const budgeted = members.slice(0, Math.max(0, run.maxTurns - state.turnCount));
  await Promise.all(budgeted.map((member) => step(run, crew, member, member.personaId, state, crewNote(crew, member))));
  return state.creditsSpent >= run.budgetCredits ? 'budget_exceeded' : 'parallel_complete';
}

async function runSupervisor(run: CrewRun, crew: Crew, members: CrewMember[], state: RunState): Promise<string> {
  const supervisor = members.find((m) => m.isSupervisor) ?? members[0];
  const delegates = members.filter((m) => m.id !== supervisor.id);

  const supervisorNote =
    crewNote(crew, supervisor) +
    '\n\nDecide which teammate should act next. Reply with exactly one `@handle` to delegate to them, ' +
    'or reply with the single word DONE once the task is complete. Do not do the delegated work yourself.';

  for (;;) {
    if (await cancelled(state)) return 'cancelled';
    if (state.turnCount >= run.maxTurns) return 'max_turns_reached';
    if (state.creditsSpent >= run.budgetCredits) return 'budget_exceeded';

    const supervisorMsg = await step(run, crew, supervisor, supervisor.personaId, state, supervisorNote);
    if (supervisorMsg.status === 'failed') return 'step_failed';
    if (/\bdone\b/i.test(supervisorMsg.content)) return 'supervisor_done';

    const allParticipants = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, run.conversationId));
    const [delegateParticipant] = parseMentions(supervisorMsg.content, allParticipants, 1)
      .filter((p) => p.participantId !== String(supervisor.personaId));
    if (!delegateParticipant) return 'supervisor_no_delegate';

    if (state.turnCount >= run.maxTurns) return 'max_turns_reached';
    const delegateMember = delegates.find((m) => String(m.personaId) === delegateParticipant.participantId);
    const delegateMsg = await step(
      run, crew, delegateMember, Number(delegateParticipant.participantId), state, crewNote(crew, delegateMember),
    );
    if (delegateMsg.status === 'failed') return 'step_failed';
    if (matchesStopCondition(delegateMsg.content, crew.stopConditions)) return 'stop_condition_matched';
  }
}

const TERMINAL_STATUS: Record<string, CrewRun['status']> = {
  max_turns_reached: 'max_turns_reached',
  budget_exceeded: 'budget_exceeded',
  step_failed: 'failed',
  no_members: 'failed',
  // A run somebody stopped is neither completed nor failed. Without this the
  // map's fall-through would record it as 'completed' — a small lie, told
  // every single time anyone cancels.
  cancelled: 'cancelled',
};

export type ExecuteOptions = {
  /**
   * Asked between steps. Returning true stops the run cleanly.
   *
   * Cooperative by design: a step is one `runPersonaTurn` call and there is no
   * way to abort a provider request already in flight, so a cancel takes effect
   * after the current persona finishes speaking rather than instantly.
   */
  shouldCancel?: () => Promise<boolean>;
};

export async function executeCrewRun(crewRunId: string, options: ExecuteOptions = {}): Promise<CrewRun> {
  const [run] = await db.select().from(crewRuns).where(eq(crewRuns.id, crewRunId)).limit(1);
  if (!run) throw new Error(`Crew run ${crewRunId} not found.`);
  if (run.status !== 'queued') return run; // already started — avoid double-execution on a re-invoked action

  const [crew] = await db.select().from(crews).where(eq(crews.id, run.crewId)).limit(1);
  if (!crew) throw new Error(`Crew ${run.crewId} not found.`);
  const members = await db.select().from(crewMembers).where(eq(crewMembers.crewId, crew.id)).orderBy(crewMembers.position);

  await db.update(crewRuns).set({ status: 'running', startedAt: new Date() }).where(eq(crewRuns.id, run.id));

  const state: RunState = { turnCount: 0, creditsSpent: 0, shouldCancel: options.shouldCancel };

  let stopReason: string;
  try {
    if (members.length === 0) {
      stopReason = 'no_members';
    } else if (crew.mode === 'parallel') {
      stopReason = await runParallel(run, crew, members, state);
    } else if (crew.mode === 'supervisor') {
      stopReason = await runSupervisor(run, crew, members, state);
    } else {
      stopReason = await runSequential(run, crew, members, state);
    }
  } catch (error) {
    console.error(`[crews] run ${crewRunId} failed`, error);
    const [failed] = await db
      .update(crewRuns)
      .set({
        status: 'failed',
        stopReason: error instanceof Error ? error.message : 'Unknown error',
        turnCount: state.turnCount,
        creditsSpent: state.creditsSpent,
        completedAt: new Date(),
      })
      .where(eq(crewRuns.id, run.id))
      .returning();
    return failed;
  }

  const [finished] = await db
    .update(crewRuns)
    .set({ status: TERMINAL_STATUS[stopReason] ?? 'completed', stopReason, completedAt: new Date() })
    .where(eq(crewRuns.id, run.id))
    .returning();

  return finished;
}
