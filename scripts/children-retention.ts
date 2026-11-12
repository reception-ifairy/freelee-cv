/**
 * What the daily retention sweep would do (docs/54) — counts only, dry run unless --apply.
 *
 *   npx tsx --conditions=react-server scripts/children-retention.ts
 *   npx tsx --conditions=react-server scripts/children-retention.ts --now=2027-12-01   # as if it were that day (dry run)
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const { runRetentionSweep } = await import('../src/lib/children/retention');
const nowArg = process.argv.find((a) => a.startsWith('--now='))?.slice(6);
const apply = process.argv.includes('--apply') && !nowArg;
console.log(await runRetentionSweep({ dryRun: !apply, now: nowArg ? new Date(nowArg) : undefined }));
process.exit(0);
