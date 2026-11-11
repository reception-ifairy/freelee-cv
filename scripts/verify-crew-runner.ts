/**
 * The bot-team rules that each shipped a bug nobody could see without running
 * a paid team: when a lead is "done", who an "all at once" run includes, what
 * status a stopped run gets, the order a saved team runs in, and whether every
 * way a run can end has a sentence a person can read.
 *
 * All pure — no database, no model calls, no credits.
 *
 *   npx tsx scripts/verify-crew-runner.ts
 */
import {
  STOP_REASONS, effectiveMaxTurns, firstMentionedHandle, leadSaysDone, parallelBatch, statusForStopReason,
} from '../src/modules/crews/rules';
import { checkTeam } from '../src/modules/crews/team-check';
import { MODE_COPY, MODE_ORDER, ordinal, runOutcome, teamSummary } from '../src/modules/crews/labels';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nBot-team runner rules\n');

console.log('When the lead is done');
check('a bare DONE ends the run', leadSaysDone('DONE'));
check('lower case and padding are fine', leadSaysDone('  done  '));
check('DONE on its own line after a summary', leadSaysDone('The brief is written and checked.\n\nDONE'));
check('markdown emphasis around DONE still counts', leadSaysDone('**DONE**'));
check('a closing full stop still counts', leadSaysDone('Done.'));
check('"not done yet" does not end the run', !leadSaysDone("I'm not done yet — @writer, draft the intro."));
check('"once that is done" does not end the run', !leadSaysDone('@editor, once that is done, check the tone.'));
check('"Done: summary" on one line does not end the run', !leadSaysDone('Done: here is the summary of the work.'));
check('"abandoned" (contains "done") does not end the run', !leadSaysDone('Nothing was abandoned.'));
check('Windows line endings', leadSaysDone('All good.\r\nDONE\r\n'));

console.log('\nWho the lead handed the work to');
check('the earliest teammate mentioned wins', firstMentionedHandle('Ask @editor, then @writer.', ['writer', 'editor']) === 'editor');
check('the lead naming itself is ignored', firstMentionedHandle('@lead will review after @writer drafts.', ['writer']) === 'writer');
check('handles match case-insensitively', firstMentionedHandle('@Writer please draft it', ['writer']) === 'writer');
check('a stranger is not a teammate', firstMentionedHandle('@nobody do it', ['writer']) === null);
check('no mention at all is null', firstMentionedHandle('Let us think about this.', ['writer']) === null);

console.log('\n"All at once" includes everyone');
const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
check('seven bots with a limit of 6 all answer', parallelBatch(seven, 6, 0).length === 7, `${parallelBatch(seven, 6, 0).length}`);
check('a limit above the team size changes nothing', parallelBatch(seven, 20, 0).length === 7);
check('order is kept', parallelBatch(seven, 1, 0).join('') === 'abcdefg');
check('effective limit is the member count when that is larger', effectiveMaxTurns('parallel', 6, 7) === 7);
check('"one after another" keeps the limit as typed', effectiveMaxTurns('sequential', 6, 7) === 6);
check('"a lead bot delegates" keeps the limit as typed', effectiveMaxTurns('supervisor', 4, 7) === 4);

console.log('\nHow a run is recorded');
check('a lead that named nobody is not "completed"', statusForStopReason('supervisor_no_delegate') !== 'completed',
  statusForStopReason('supervisor_no_delegate'));
check('a cancel is recorded as cancelled', statusForStopReason('cancelled') === 'cancelled');
check('the turn limit is its own status', statusForStopReason('max_turns_reached') === 'max_turns_reached');
check('a lead saying DONE is completed', statusForStopReason('supervisor_done') === 'completed');
for (const reason of STOP_REASONS) {
  const outcome = runOutcome(statusForStopReason(reason), reason);
  check(`"${reason}" reads as a sentence`, outcome.sentence.length > 10 && !outcome.sentence.includes('_'), outcome.sentence);
}
const noDelegate = runOutcome(statusForStopReason('supervisor_no_delegate'), 'supervisor_no_delegate');
check('the lead-named-nobody sentence says "Stopped", not "Failed"', noDelegate.sentence.startsWith('Stopped'), noDelegate.sentence);
const crashed = runOutcome('failed', 'connect ECONNREFUSED 127.0.0.1:5432');
check('an exception message is kept as detail, not shown as the sentence', crashed.detail?.includes('ECONNREFUSED') === true && !crashed.sentence.includes('ECONN'));
check('a queued run says it is waiting', runOutcome('queued', null).label === 'Waiting');

console.log('\nSaving a team');
const json = (list: unknown) => JSON.stringify(list);
const ordered = checkTeam('sequential', json([
  { personaId: 30, instructions: 'research', isLead: false },
  { personaId: 10, instructions: '', isLead: false },
  { personaId: 20, instructions: '  edit  ', isLead: false },
]), 6);
check('members are saved in the order given, not by id',
  ordered.ok && ordered.members.map((m) => `${m.position}:${m.personaId}`).join(',') === '0:30,1:10,2:20',
  ordered.ok ? ordered.members.map((m) => `${m.position}:${m.personaId}`).join(',') : ordered.error);
check('roles are kept (trimmed), blank ones become null',
  ordered.ok && ordered.members[0].instructions === 'research' && ordered.members[1].instructions === null && ordered.members[2].instructions === 'edit');
check('an empty team is refused', !checkTeam('sequential', json([]), 6).ok);
check('the same bot twice is refused', !checkTeam('sequential', json([{ personaId: 1 }, { personaId: 1 }]), 6).ok);
check('a garbled list is refused, not thrown', !checkTeam('sequential', 'not json', 6).ok);
check('a missing list is refused, not thrown', !checkTeam('sequential', null, 6).ok);
check('lead mode without a lead is refused', !checkTeam('supervisor', json([{ personaId: 1 }, { personaId: 2 }]), 6).ok);
check('lead mode with two leads is refused',
  !checkTeam('supervisor', json([{ personaId: 1, isLead: true }, { personaId: 2, isLead: true }]), 6).ok);
check('a lead with nobody to delegate to is refused', !checkTeam('supervisor', json([{ personaId: 1, isLead: true }]), 6).ok);
const led = checkTeam('supervisor', json([{ personaId: 1 }, { personaId: 2, isLead: true }]), 6);
check('exactly one lead is saved as the supervisor', led.ok && led.members.filter((m) => m.isSupervisor).map((m) => m.personaId).join() === '2');
const leadDropped = checkTeam('sequential', json([{ personaId: 1, isLead: true }, { personaId: 2 }]), 6);
check('a crown is not kept outside lead mode', leadDropped.ok && leadDropped.members.every((m) => !m.isSupervisor));
const raised = checkTeam('parallel', json([1, 2, 3, 4, 5, 6, 7].map((personaId) => ({ personaId }))), 6);
check('"all at once" with 7 bots raises a limit of 6 to 7 and says from what',
  raised.ok && raised.maxTurns === 7 && raised.raisedTurnsFrom === 6);
const kept = checkTeam('parallel', json([{ personaId: 1 }, { personaId: 2 }]), 6);
check('a limit that already fits is left alone', kept.ok && kept.maxTurns === 6 && kept.raisedTurnsFrom === null);
const longRole = checkTeam('sequential', json([{ personaId: 1, instructions: 'x'.repeat(1001) }]), 6);
check('an over-long role is refused with a readable message', !longRole.ok && longRole.error.startsWith('Keep each role'),
  longRole.ok ? 'accepted' : longRole.error);

console.log('\nPlain words');
check('three modes, each with a label, an explanation and an example',
  MODE_ORDER.length === 3 && MODE_ORDER.every((m) => MODE_COPY[m].label && MODE_COPY[m].explanation && MODE_COPY[m].example));
check('no mode label uses the stored jargon',
  MODE_ORDER.every((m) => !/sequential|parallel|supervisor|pipeline|fan-out/i.test(MODE_COPY[m].label)));
check('ordinals', ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']
  .join() === [1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal).join(), [1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal).join());
const summary = teamSummary({ memberCount: 3, mode: 'sequential', maxTurns: 6, budgetCredits: 50 });
check('team summary', summary === '3 bots · one after another · up to 6 turns · budget 50 credits', summary);
const parallelSummary = teamSummary({ memberCount: 8, mode: 'parallel', maxTurns: 6, budgetCredits: 1200 });
check('summary shows the limit a run really gets', parallelSummary === '8 bots · all at once · up to 8 turns · budget 1,200 credits', parallelSummary);

console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed === 0 ? 0 : 1);
