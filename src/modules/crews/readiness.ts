import 'server-only';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { personas } from '@/db/schema';
import { getBalanceForTeam, MINIMUM_CHARGE } from '@/lib/billing/credits';
import { hasActiveEntitlement } from '@/lib/billing/entitlements';
import { getPlatformTeamId } from '@/lib/teams';
import type { Crew, CrewMember } from './schema';

/**
 * Can this team run right now — asked *before* anything is spent.
 *
 * Every one of these used to be discovered by starting a run and watching it
 * fail: a member with no published version fails its step inside
 * `runPersonaTurn` ("This persona has no published version."), an empty wallet
 * fails every step ("The team is out of credits."), a lead-mode team with no
 * lead quietly promoted whoever was first. Each of those is a run record, a
 * conversation and a job for a question that a database read answers for free.
 *
 * The test-run box shows the list and disables Start with the first problem;
 * `startAdminCrewRunAction` asks the same function again, so a stale page
 * cannot start what the server would refuse.
 */

export type ReadinessCheck = {
  ok: boolean;
  label: string;
  detail?: string;
  /** Passes, but worth knowing — shown amber, never blocks Start. */
  warning?: boolean;
};

export type CrewReadiness = {
  ready: boolean;
  /** The first failing check as one sentence, for the disabled Start button and the server's refusal. */
  blocker: string | null;
  checks: ReadinessCheck[];
};

export async function crewReadiness(
  crew: Pick<Crew, 'teamId' | 'isActive' | 'mode' | 'budgetCredits'>,
  members: Pick<CrewMember, 'personaId' | 'isSupervisor'>[],
): Promise<CrewReadiness> {
  const checks: ReadinessCheck[] = [];

  checks.push(
    crew.isActive
      ? { ok: true, label: 'The team is switched on' }
      : { ok: false, label: 'The team is switched off', detail: 'Tick "Enabled" under Build → Limits, then save.' },
  );

  if (members.length === 0) {
    checks.push({ ok: false, label: 'The team has no bots', detail: 'Add bots on the Build tab.' });
  } else {
    checks.push({ ok: true, label: members.length === 1 ? '1 bot on the team' : `${members.length} bots on the team` });
  }

  if (crew.mode === 'supervisor' && members.length > 0) {
    if (!members.some((m) => m.isSupervisor)) {
      checks.push({ ok: false, label: 'No lead is chosen', detail: 'Press the crown next to one bot on the Build tab.' });
    } else if (members.length < 2) {
      checks.push({ ok: false, label: 'The lead has nobody to hand work to', detail: 'Add at least one more bot.' });
    } else {
      checks.push({ ok: true, label: 'A lead is chosen' });
    }
  }

  // "Published" is exactly what runPersonaTurn needs: a current version to
  // answer from. Read here so the answer is the runner's, not a guess.
  const memberPersonas = members.length
    ? await db
        .select({ id: personas.id, name: personas.name, currentVersionId: personas.currentVersionId })
        .from(personas)
        .where(inArray(personas.id, members.map((m) => m.personaId)))
    : [];
  const unpublished = memberPersonas.filter((p) => p.currentVersionId === null).map((p) => p.name);
  if (members.length > 0) {
    checks.push(
      unpublished.length === 0
        ? { ok: true, label: 'Every bot is published' }
        : {
            ok: false,
            label: `Not published yet: ${unpublished.join(', ')}`,
            detail: 'Publish them (Personas → the bot → Publishing tab) or take them off the team.',
          },
    );
  }

  // The wallet the run will actually be charged: the crew's own team. For a
  // team built here that is the platform's; a customer's team opened from the
  // admin list bills the customer, and the check should say so rather than
  // report the platform's balance for somebody else's money.
  const [platformTeamId, covered, balance] = await Promise.all([
    getPlatformTeamId(),
    hasActiveEntitlement(crew.teamId, 'platform'),
    getBalanceForTeam(crew.teamId),
  ]);
  const wallet = crew.teamId === platformTeamId ? 'The platform wallet' : "The owning customer's wallet";

  if (covered) {
    checks.push({ ok: true, label: `${wallet} is covered by an active pass` });
  } else if (balance < MINIMUM_CHARGE) {
    checks.push({ ok: false, label: `${wallet} is empty`, detail: 'Every bot reply costs credits. Top the wallet up first.' });
  } else if (balance < crew.budgetCredits) {
    checks.push({
      ok: true,
      warning: true,
      label: `${wallet} has ${balance.toLocaleString('en')} credits`,
      detail: `Less than this team's budget of ${crew.budgetCredits.toLocaleString('en')}, so a run may stop early.`,
    });
  } else {
    checks.push({ ok: true, label: `${wallet} has ${balance.toLocaleString('en')} credits` });
  }

  const failing = checks.find((c) => !c.ok);
  return {
    ready: !failing,
    blocker: failing ? [failing.label, failing.detail].filter(Boolean).join('. ').replace(/\.\./g, '.') : null,
    checks,
  };
}
