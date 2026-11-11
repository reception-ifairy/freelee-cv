/**
 * The decisions a bot team makes that need no database.
 *
 * Pulled out of runner.ts and the admin save action for one reason: each of
 * them shipped a bug that nobody could see without running a paid team. "Any
 * reply containing the word done ends the run", "a fan-out silently drops
 * every member past the turn limit", "the lead named nobody, so the run is
 * *completed*" — all three are a one-line rule, and a one-line rule can be
 * checked by `scripts/verify-crew-runner.ts` for free. No `server-only`, no
 * `db`, so that script can import this file directly — and no zod either:
 * the builder and the list import from here, and a schema constructed at
 * module scope would ship the whole validator to the browser with them. The
 * save-time validation that needs zod lives in team-check.ts.
 */

export type CrewModeValue = 'sequential' | 'parallel' | 'supervisor';

/**
 * Every reason a run can end with, as the runner writes it to
 * `crew_runs.stop_reason`. A closed list rather than free strings so the
 * status mapping below has to answer for each one — the old map was partial
 * and anything it forgot fell through to `completed`.
 */
export const STOP_REASONS = [
  'sequential_complete',
  'parallel_complete',
  'supervisor_done',
  'stop_condition_matched',
  'max_turns_reached',
  'budget_exceeded',
  'step_failed',
  'no_members',
  'cancelled',
  'supervisor_no_delegate',
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

/** The terminal values of `crew_run_status`. Kept as literals so this file stays importable without the schema. */
export type TerminalRunStatus = 'completed' | 'failed' | 'budget_exceeded' | 'max_turns_reached' | 'cancelled';

/**
 * Total over StopReason, so a new reason cannot be added without deciding its
 * status — the compiler refuses a missing key.
 *
 * `supervisor_no_delegate` is the one that used to be wrong: it was absent
 * from the map, fell through to `completed`, and a lead that handed the task
 * to nobody was reported as a finished job. It is **not** a success. The
 * status enum has no `stopped` value and adding one is a migration, so it is
 * recorded as `failed` and the stop reason carries the distinction — every
 * admin screen reads the reason first (see `runOutcome` in labels.ts) and says
 * "Stopped — the lead didn't hand the task to anyone", not "Failed".
 */
const STATUS_FOR_STOP_REASON: Record<StopReason, TerminalRunStatus> = {
  sequential_complete: 'completed',
  parallel_complete: 'completed',
  supervisor_done: 'completed',
  stop_condition_matched: 'completed',
  max_turns_reached: 'max_turns_reached',
  budget_exceeded: 'budget_exceeded',
  step_failed: 'failed',
  no_members: 'failed',
  // A run somebody stopped is neither completed nor failed.
  cancelled: 'cancelled',
  supervisor_no_delegate: 'failed',
};

export function statusForStopReason(reason: StopReason): TerminalRunStatus {
  return STATUS_FOR_STOP_REASON[reason];
}

export function isStopReason(value: string | null | undefined): value is StopReason {
  return (STOP_REASONS as readonly string[]).includes(value ?? '');
}

/**
 * Whether the lead's reply ends the run.
 *
 * Used to be `/\bdone\b/i` over the whole reply, so "I'm not done yet —
 * @writer, draft the intro" ended the run on the spot, as did "once that's
 * done". The lead is now told to put DONE on a line by itself, and only a line
 * that *is* DONE counts.
 *
 * Tolerates the two decorations models add without being asked — markdown
 * emphasis (`**DONE**`) and a closing full stop (`DONE.`) — because a lead
 * that clearly said it was finished and got recorded as "handed the task to
 * nobody" would be a new lie in place of the old one. Anything else on the
 * line ("Done: here is the summary", "not done") does not count.
 */
export function leadSaysDone(reply: string): boolean {
  return reply.split(/\r?\n/).some((line) => {
    const bare = line.trim().replace(/^[*_`~]+/, '').replace(/[*_`~]+$/, '').replace(/[.!]+$/, '').trim();
    return bare.toLowerCase() === 'done';
  });
}

/**
 * The turn limit a run actually gets.
 *
 * "All at once" gives every member exactly one turn, so a limit below the
 * member count cannot mean anything except "silently leave some of them out"
 * — which is what the runner used to do (`members.slice(0, maxTurns)`). The
 * builder raises the stored limit when you save and says so; this covers teams
 * saved before that, and the customer side, which has no builder.
 */
export function effectiveMaxTurns(mode: CrewModeValue, maxTurns: number, memberCount: number): number {
  return mode === 'parallel' ? Math.max(maxTurns, memberCount) : maxTurns;
}

/** The members an "all at once" round runs: every one of them, unless turns were already spent. */
export function parallelBatch<T>(members: readonly T[], maxTurns: number, turnsUsed: number): T[] {
  const limit = effectiveMaxTurns('parallel', maxTurns, members.length);
  return members.slice(0, Math.max(0, limit - turnsUsed));
}

/**
 * Which teammate the lead handed the work to: the earliest `@handle` in its
 * reply that belongs to one of `handles`.
 *
 * `parseMentions` (group-chat) returns matches in *participant* order and was
 * cut to one before the lead itself was filtered out, so "@lead-bot will
 * review after @writer drafts" could resolve to nobody, and "ask @editor, then
 * @writer" picked whichever joined the room first. Earliest mention is what a
 * person reading the reply would take it to mean.
 */
export function firstMentionedHandle(reply: string, handles: readonly string[]): string | null {
  const wanted = new Set(handles.map((h) => h.toLowerCase()));
  for (const match of reply.matchAll(/@([a-zA-Z0-9_-]+)/g)) {
    const handle = match[1].toLowerCase();
    if (wanted.has(handle)) return handle;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Saving a team from the builder
// ---------------------------------------------------------------------------

/** More than this is a crowd, not a team — and every member of an "all at once" team is a paid reply. */
export const MAX_TEAM_SIZE = 20;
export const MAX_ROLE_LENGTH = 1000;

/** The builder's fields, so a save can point at the one that is wrong. */
export const TEAM_FIELDS = [
  'name', 'description', 'mode', 'members', 'budgetCredits', 'maxTurns', 'stopConditions', 'projectId',
] as const;
export type TeamField = (typeof TEAM_FIELDS)[number];

export type TeamSaveState = {
  error?: string;
  success?: string;
  /** The field the error is about — the builder shows the message under it. */
  field?: TeamField;
  /** The turn limit as saved, which may be higher than the one typed (see `checkTeam`). */
  maxTurns?: number;
} | null;

export type CheckedMember = { personaId: number; position: number; instructions: string | null; isSupervisor: boolean };

export type CheckedTeam =
  | { ok: true; members: CheckedMember[]; maxTurns: number; raisedTurnsFrom: number | null }
  | { ok: false; error: string };
