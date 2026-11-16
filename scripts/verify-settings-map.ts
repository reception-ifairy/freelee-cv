/**
 * Checks that every setting has exactly one home (freelee #86): each of the
 * 13 connections is in Settings → Integrations once, in one group (since #93;
 * /admin/connections before); each key in
 * SETTINGS_SCHEMA is edited either by one Settings section (SECTION_FIELDS)
 * or by one connection — never both, never neither. Before, Resend's key had
 * a card in Email and a field in the AI schema form, and three keys
 * (Google's default model, moderation, blocked words) had no screen at all
 * until #62.
 *
 * Imports the connection registry, which is server-only, hence the
 * react-server condition; nothing here touches the network or the database.
 *
 *   npx tsx --conditions=react-server scripts/verify-settings-map.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const { SETTINGS_SCHEMA } = await import('../src/lib/settings-schema');
const { SECTION_FIELDS, SETTINGS_SECTIONS, MOVED_SECTIONS } = await import('../src/lib/admin/settings-sections');
const { CONNECTION_IDS, connectionSettingKeys } = await import('../src/lib/connections/registry');
const { CONNECTION_GROUPS, connectionHealth, connectionHref, hrefForConnectionsHash, integrationsSectionId } = await import('../src/lib/admin/connection-groups');

let failed = 0;
function check(name: string, fn: () => boolean | string) {
  try {
    const r = fn();
    if (r !== true) throw new Error(typeof r === 'string' ? r : 'returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

const schemaKeys = Object.values(SETTINGS_SCHEMA).flatMap((fields) => (fields as { key: string }[]).map((f) => f.key));
const homes = new Map<string, string[]>();
const addHome = (key: string, home: string) => homes.set(key, [...(homes.get(key) ?? []), home]);
for (const [section, keys] of Object.entries(SECTION_FIELDS)) for (const key of keys) addHome(key, `settings:${section}`);
for (const id of CONNECTION_IDS) for (const key of connectionSettingKeys(id)) addHome(key, `connection:${id}`);

console.log('Connections');
check('all 13 connections, each in exactly one group', () => {
  const placed = CONNECTION_GROUPS.flatMap((g) => g.ids);
  const missing = CONNECTION_IDS.filter((id) => !placed.includes(id));
  const twice = placed.filter((id, i) => placed.indexOf(id) !== i);
  return (CONNECTION_IDS.length === 13 && missing.length === 0 && twice.length === 0) || `missing ${missing}, twice ${twice}`;
});
check('health reads: not set up, never tested, working, failing', () =>
  JSON.stringify([
    connectionHealth({ configured: false, lastTest: null }),
    connectionHealth({ configured: true, lastTest: null }),
    connectionHealth({ configured: true, lastTest: { state: 'ok' } }),
    connectionHealth({ configured: true, lastTest: { state: 'no-credit' } }),
  ]) === JSON.stringify(['off', 'untested', 'working', 'failing']));

console.log('One home per key');
check(`every one of the ${schemaKeys.length} schema keys has a home`, () => {
  const homeless = schemaKeys.filter((key) => !homes.has(key));
  return homeless.length === 0 || `no screen edits: ${homeless.join(', ')}`;
});
check('no key has two homes (a section and a connection, or two sections)', () => {
  const doubled = [...homes.entries()].filter(([, where]) => where.length > 1);
  return doubled.length === 0 || doubled.map(([key, where]) => `${key} → ${where.join(' + ')}`).join('; ');
});
check('every key a section or connection names exists in the schema', () => {
  const unknown = [...homes.keys()].filter((key) => !schemaKeys.includes(key));
  return unknown.length === 0 || `not in SETTINGS_SCHEMA: ${unknown.join(', ')}`;
});
check('free use is under Billing, moderation under Safety, provider keys under Connections', () =>
  homes.get('guest_free_messages')?.[0] === 'settings:billing' &&
  homes.get('moderation_mode')?.[0] === 'settings:safety' &&
  homes.get('openai_api_key')?.[0] === 'connection:openai' &&
  homes.get('elevenlabs_voice_id')?.[0] === 'connection:elevenlabs');

console.log('Sections');
check('every settings form section declares its fields; link sections declare none', () => {
  const bad = SETTINGS_SECTIONS.filter((s) => (s.schemaGroup ? !SECTION_FIELDS[s.id]?.length : Boolean(SECTION_FIELDS[s.id])));
  return bad.length === 0 || bad.map((s) => s.id).join(', ');
});
check('Integrations: one Settings section per connection group, plus All', () =>
  ['integrations', ...CONNECTION_GROUPS.map((g) => integrationsSectionId(g.id))].every((id) => SETTINGS_SECTIONS.some((s) => s.id === id && !s.href)));
check('a connection’s link opens its card in its group', () =>
  connectionHref('anthropic') === '/admin/settings?section=integrations-ai&open=anthropic' &&
  connectionHref('curriculum') === '/admin/settings?section=integrations-knowledge&open=curriculum');
check('old /admin/connections anchors land on the card or group they named; others are left alone', () =>
  hrefForConnectionsHash('#conn-resend') === '/admin/settings?section=integrations-email&open=resend' &&
  hrefForConnectionsHash('#group-payments') === '/admin/settings?section=integrations-payments' &&
  hrefForConnectionsHash('#conn-nope') === null &&
  hrefForConnectionsHash('#top') === null);
check('the old Connections and Media storage sections redirect into Integrations', () =>
  MOVED_SECTIONS.connections === '/admin/settings?section=integrations' && MOVED_SECTIONS.storage.includes('open=s3'));
check('a moved section is not still a tab here (it redirects)', () =>
  Object.keys(MOVED_SECTIONS).every((id) => !SETTINGS_SECTIONS.some((s) => s.id === id && !s.href)));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll settings-map checks passed.');
process.exit(0);
