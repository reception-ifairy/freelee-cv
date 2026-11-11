import { z } from 'zod';
import {
  MAX_ROLE_LENGTH, MAX_TEAM_SIZE, effectiveMaxTurns, type CheckedTeam, type CrewModeValue,
} from './rules';

/**
 * Validates the builder's member list and turns it into `crew_members` rows.
 *
 * Its own file only because it needs zod and rules.ts is imported by client
 * components (see the note there). Still pure — no `db`, no `server-only` — so
 * `scripts/verify-crew-runner.ts` checks it directly.
 *
 * The list arrives as one ordered JSON array in a hidden input. That is the
 * whole fix for turn order: the old form sent ticked checkboxes, the browser
 * submits those in *page* order, and the page was alphabetical — so "the order
 * you tick them is the order they run in" was never true. An array has an
 * order, and position is its index.
 */

const memberSchema = z.object({
  personaId: z.number().int().positive(),
  instructions: z
    .string()
    .max(MAX_ROLE_LENGTH, `Keep each role under ${MAX_ROLE_LENGTH.toLocaleString('en')} characters.`)
    .default(''),
  isLead: z.boolean().default(false),
});

const GARBLED = 'The team list did not come through. Reload the page and try again.';

export function checkTeam(mode: CrewModeValue, membersJson: unknown, maxTurns: number): CheckedTeam {
  let raw: unknown;
  try {
    raw = JSON.parse(typeof membersJson === 'string' ? membersJson : '');
  } catch {
    return { ok: false, error: GARBLED };
  }

  const parsed = z.array(memberSchema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // The role length is the one problem a person can cause and fix; anything
    // else means the hidden field was tampered with or the page is stale.
    return { ok: false, error: issue?.code === 'too_big' ? issue.message : GARBLED };
  }
  const list = parsed.data;

  if (list.length === 0) return { ok: false, error: 'Add at least one bot to the team.' };
  if (list.length > MAX_TEAM_SIZE) return { ok: false, error: `A team can have at most ${MAX_TEAM_SIZE} bots.` };
  if (new Set(list.map((m) => m.personaId)).size !== list.length) {
    return { ok: false, error: 'The same bot is on the team twice. Remove one of them.' };
  }

  if (mode === 'supervisor') {
    const leads = list.filter((m) => m.isLead).length;
    if (leads === 0) return { ok: false, error: 'Pick a lead: press the crown next to the bot that should hand out the work.' };
    if (leads > 1) return { ok: false, error: 'Only one bot can be the lead.' };
    // A lead with nobody to delegate to can only ever end "handed the task to
    // nobody" — refuse the team rather than sell a run that cannot work.
    if (list.length < 2) return { ok: false, error: 'A lead needs at least one other bot to hand work to.' };
  }

  const effective = effectiveMaxTurns(mode, maxTurns, list.length);

  return {
    ok: true,
    members: list.map((m, index) => ({
      personaId: m.personaId,
      position: index,
      instructions: m.instructions.trim() || null,
      // Only meaningful in lead mode. Cleared otherwise so a team switched
      // away from "a lead bot delegates" does not keep a crown nobody can see.
      isSupervisor: mode === 'supervisor' && m.isLead,
    })),
    maxTurns: effective,
    raisedTurnsFrom: effective !== maxTurns ? maxTurns : null,
  };
}
