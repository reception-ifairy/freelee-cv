import { effectiveMaxTurns, isStopReason, type CrewModeValue, type StopReason } from './rules';

/**
 * What the admin calls things — plain words for values stored as jargon.
 *
 * The database keeps `sequential`/`parallel`/`supervisor` and
 * `max_turns_reached`; those are accurate, stable and never shown. Screens
 * used to print them with the underscores swapped for spaces ("max turns
 * reached", "sequential complete"), which reads like a log file. One module,
 * so the list, the team page and the run page cannot drift into three
 * vocabularies — which is roughly what "Pipeline", "sequential" and "Turn
 * order" had become.
 */

export type ModeCopy = {
  /** The name, as a card title. */
  label: string;
  /** The same, mid-sentence: "3 bots · one after another · …". */
  short: string;
  /** One line on what happens. */
  explanation: string;
  /** A tiny concrete case — easier to recognise than a definition. */
  example: string;
};

export const MODE_ORDER: readonly CrewModeValue[] = ['sequential', 'parallel', 'supervisor'];

export const MODE_COPY: Record<CrewModeValue, ModeCopy> = {
  sequential: {
    label: 'One after another',
    short: 'one after another',
    explanation: 'Each bot builds on the previous answer.',
    example: 'A researcher finds facts, a writer drafts, an editor polishes.',
  },
  parallel: {
    label: 'All at once',
    short: 'all at once',
    explanation: 'Every bot answers the same task on its own — good for comparing.',
    example: 'Three copywriters each pitch a slogan; you pick one.',
  },
  supervisor: {
    label: 'A lead bot delegates',
    short: 'a lead bot delegates',
    explanation: 'One bot hands work to the others and decides when it is done.',
    example: 'A project lead asks the researcher, then the writer, then says it is finished.',
  },
};

export function modeCopy(mode: string): ModeCopy {
  return MODE_COPY[mode as CrewModeValue] ?? MODE_COPY.sequential;
}

/** "1st", "2nd", "3rd", "11th", "22nd" — the turn number shown beside a bot in "one after another". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "3 bots · one after another · up to 6 turns · budget 50 credits" */
export function teamSummary(team: { memberCount: number; mode: string; maxTurns: number; budgetCredits: number }): string {
  const turns = effectiveMaxTurns(team.mode as CrewModeValue, team.maxTurns, team.memberCount);
  return [
    team.memberCount === 1 ? '1 bot' : `${team.memberCount} bots`,
    modeCopy(team.mode).short,
    `up to ${turns} turn${turns === 1 ? '' : 's'}`,
    `budget ${team.budgetCredits.toLocaleString('en')} credits`,
  ].join(' · ');
}

export type OutcomeTone = 'green' | 'amber' | 'rose' | 'slate' | 'brand';

export type RunOutcome = {
  /** A badge: two or three words. */
  label: string;
  /** The full plain sentence: "Stopped — reached the turn limit". */
  sentence: string;
  tone: OutcomeTone;
  /** Anything the runner recorded that is not one of its own reasons — an exception message, shown as-is. */
  detail?: string;
};

/** How each way of ending reads. Keyed by stop reason, because the status alone cannot tell "the lead gave up" from "a bot errored". */
const STOP_REASON_OUTCOME: Record<StopReason, RunOutcome> = {
  sequential_complete: { label: 'Finished', sentence: 'Finished — every bot had its turn', tone: 'green' },
  parallel_complete: { label: 'Finished', sentence: 'Finished — every bot answered', tone: 'green' },
  supervisor_done: { label: 'Finished', sentence: 'Finished — the lead said the work is done', tone: 'green' },
  stop_condition_matched: { label: 'Finished', sentence: 'Finished — a reply used the stop phrase', tone: 'green' },
  max_turns_reached: { label: 'Turn limit', sentence: 'Stopped — reached the turn limit', tone: 'amber' },
  budget_exceeded: { label: 'Budget used up', sentence: 'Stopped — used up its credit budget', tone: 'rose' },
  step_failed: { label: 'A bot failed', sentence: 'Failed — a bot could not reply (the steps show which and why)', tone: 'rose' },
  no_members: { label: 'No bots', sentence: 'Failed — the team had no bots', tone: 'rose' },
  cancelled: { label: 'Stopped by you', sentence: 'Stopped — someone pressed Stop', tone: 'slate' },
  supervisor_no_delegate: { label: "Lead didn't delegate", sentence: "Stopped — the lead didn't hand the task to anyone", tone: 'amber' },
};

/**
 * A run's status and stop reason as one plain sentence.
 *
 * The reason wins over the status when there is one: `failed` covers both "a
 * bot errored" and "the lead named nobody" (see rules.ts for why), and those
 * call for different next steps.
 */
export function runOutcome(status: string, stopReason: string | null | undefined): RunOutcome {
  if (status === 'queued') return { label: 'Waiting', sentence: 'Waiting to start', tone: 'slate' };
  if (status === 'running') return { label: 'Running', sentence: 'Running — the bots are working on it', tone: 'amber' };
  if (isStopReason(stopReason)) return STOP_REASON_OUTCOME[stopReason];

  switch (status) {
    case 'completed': return { label: 'Finished', sentence: 'Finished', tone: 'green' };
    case 'max_turns_reached': return STOP_REASON_OUTCOME.max_turns_reached;
    case 'budget_exceeded': return STOP_REASON_OUTCOME.budget_exceeded;
    case 'cancelled': return STOP_REASON_OUTCOME.cancelled;
    case 'failed':
      // The runner's catch-all writes the exception message as the reason.
      return { label: 'Failed', sentence: 'Failed — something went wrong', tone: 'rose', detail: stopReason ?? undefined };
    default:
      return { label: status, sentence: status, tone: 'slate' };
  }
}
